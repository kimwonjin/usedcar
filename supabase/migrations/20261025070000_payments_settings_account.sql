-- 1) 수수료 구간표(관리자 수정) + 딜러 수수료 청구서
-- 2) 결제 기록: 결제 업체 연동 전에는 'mock' 모드로 개발, 연동 후 웹훅이 결제 완료 처리
-- 3) 미납 수수료가 기한을 넘기면 입찰 제한 (설정으로 끌 수 있음)
-- 4) 회원 탈퇴 (개인정보 삭제·로그인 차단, 거래 기록은 익명으로 보존)
-- 5) 딜러 새 매물 알림 설정 (끄기, 제조사 선택)

-- ─────────────────────────────────────────────
-- 1) 수수료 구간표
-- ─────────────────────────────────────────────
create table public.fee_bands (
  id serial primary key,
  max_price bigint check (max_price > 0), -- null = 그 이상 전부
  fee bigint not null check (fee >= 0)
);
alter table public.fee_bands enable row level security;
create policy "fee bands: read" on public.fee_bands for select using (true);
create policy "fee bands: admin write" on public.fee_bands for all using (public.is_admin()) with check (public.is_admin());

insert into public.fee_bands (max_price, fee) values
  (3000000, 50000), (7000000, 80000), (15000000, 120000), (null, 180000);

create or replace function public.calc_dealer_fee(p_price bigint)
returns bigint language sql stable security definer set search_path = '' as $$
  select fee from public.fee_bands
  where max_price is null or p_price <= max_price
  order by max_price nulls last
  limit 1;
$$;

-- 운영 설정값 (결제 모드, 납부 기한 등). app_config와 같은 방식이지만 관리자가 화면에서 읽고 바꾼다
create table public.app_settings (
  key text primary key,
  value text not null
);
alter table public.app_settings enable row level security;
create policy "settings: read" on public.app_settings for select using (true);
create policy "settings: admin write" on public.app_settings for all using (public.is_admin()) with check (public.is_admin());

insert into public.app_settings (key, value) values
  ('payments_mode', 'mock'),              -- mock: 개발용 가짜 결제 / live: 결제 업체 웹훅으로만 완료
  ('fee_due_days', '7'),                  -- 거래 완료 후 수수료 납부 기한(일)
  ('block_bidding_on_overdue', 'true')    -- 기한 지난 미납 수수료가 있으면 입찰 제한
on conflict (key) do nothing;

create or replace function public.setting(p_key text)
returns text language sql stable security definer set search_path = '' as $$
  select value from public.app_settings where key = p_key;
$$;

-- ─────────────────────────────────────────────
-- 2) 결제
-- ─────────────────────────────────────────────
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  purpose text not null check (purpose in ('dealer_fee', 'deposit', 'reservation')),
  amount bigint not null check (amount >= 0),
  currency text not null default 'KZT',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  deal_id uuid references public.deals (id) on delete set null,
  description text,
  provider text,
  provider_ref text,
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.payments (user_id, status);
create unique index payments_one_fee_per_deal on public.payments (deal_id) where purpose = 'dealer_fee';

alter table public.payments enable row level security;
create policy "payments: own or admin read" on public.payments for select using (user_id = auth.uid() or public.is_admin());
create policy "payments: admin update" on public.payments for update using (public.is_admin());

-- 거래 완료 → 딜러에게 수수료 청구서
create or replace function public.on_deal_completed_invoice()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_fee bigint;
  v_car text;
begin
  if new.status = 'completed' and old.status <> 'completed' then
    v_fee := public.calc_dealer_fee(coalesce(new.final_price, new.agreed_price));
    v_car := public.car_label((select car_id from public.auctions where id = new.auction_id));
    insert into public.payments (user_id, purpose, amount, deal_id, description, due_at)
    values (new.dealer_id, 'dealer_fee', v_fee, new.id, v_car,
            now() + make_interval(days => coalesce(public.setting('fee_due_days')::int, 7)))
    on conflict do nothing;
    perform public.notify(new.dealer_id, 'fee_invoice', jsonb_build_object('car', v_car, 'amount', v_fee), '/dealer/billing');
  end if;
  return new;
end;
$$;

create trigger deals_fee_invoice
  after update of status on public.deals
  for each row execute function public.on_deal_completed_invoice();

-- 결제 완료 처리 (내부용): 결제 업체 웹훅 → mark_payment_paid, 개발용 → mock_pay
create or replace function public.complete_payment(p_payment_id uuid, p_provider text, p_provider_ref text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.payments
  set status = 'paid', paid_at = now(), provider = p_provider, provider_ref = p_provider_ref
  where id = p_payment_id and status in ('pending', 'failed');
  if not found then
    raise exception 'payment not payable';
  end if;
end;
$$;

-- 결제 업체 웹훅용: 서버만 아는 비밀값(app_config.payments_webhook_secret)으로 확인
create or replace function public.mark_payment_paid(p_secret text, p_payment_id uuid, p_provider text, p_provider_ref text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_secret is null or p_secret is distinct from (select value from public.app_config where key = 'payments_webhook_secret') then
    raise exception 'forbidden';
  end if;
  perform public.complete_payment(p_payment_id, p_provider, p_provider_ref);
end;
$$;

-- 개발용 가짜 결제: payments_mode = 'mock' 일 때만, 본인 청구서만
create or replace function public.mock_pay(p_payment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.setting('payments_mode') <> 'mock' then
    raise exception 'mock payments disabled';
  end if;
  if not exists (select 1 from public.payments where id = p_payment_id and user_id = auth.uid()) then
    raise exception 'payment not found';
  end if;
  perform public.complete_payment(p_payment_id, 'mock', 'mock-' || extract(epoch from now())::bigint);
end;
$$;

-- ─────────────────────────────────────────────
-- 3) 미납 수수료 입찰 제한
-- ─────────────────────────────────────────────
create or replace function public.has_overdue_fees(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.setting('block_bidding_on_overdue'), 'false') = 'true'
     and exists (select 1 from public.payments
                 where user_id = p_user and purpose = 'dealer_fee' and status = 'pending' and due_at < now());
$$;

create or replace function public.place_bid(p_auction_id uuid, p_amount bigint)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_auction public.auctions;
  v_existing bigint;
begin
  if not public.is_approved_dealer() then
    raise exception 'dealer not approved';
  end if;
  if exists (select 1 from public.dealers where id = auth.uid() and bid_blocked_until > now()) then
    raise exception 'dealer bid blocked';
  end if;
  if public.has_overdue_fees(auth.uid()) then
    raise exception 'overdue fees';
  end if;

  select * into v_auction from public.auctions where id = p_auction_id for update;
  if v_auction.id is null or v_auction.status <> 'live' or v_auction.ends_at <= now() then
    raise exception 'auction not live';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid amount';
  end if;

  select amount into v_existing from public.bids
  where auction_id = p_auction_id and dealer_id = auth.uid();
  if v_existing is not null and p_amount <= v_existing then
    raise exception 'bid can only be raised';
  end if;

  insert into public.bids (auction_id, dealer_id, amount)
  values (p_auction_id, auth.uid(), p_amount)
  on conflict (auction_id, dealer_id)
  do update set amount = excluded.amount, updated_at = now();

  return public.my_bid_rank(p_auction_id);
end;
$$;

-- ─────────────────────────────────────────────
-- 4) 회원 탈퇴
-- ─────────────────────────────────────────────
alter table public.profiles add column deleted_at timestamptz;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  -- 진행 중인 경매·거래, 미납 수수료가 있으면 먼저 정리해야 한다
  if exists (select 1 from public.auctions where seller_id = v_uid and status in ('live', 'ended')) then
    raise exception 'active auctions';
  end if;
  if exists (select 1 from public.deals where (seller_id = v_uid or dealer_id = v_uid)
             and status in ('scheduled', 'depreciation_review')) then
    raise exception 'active deals';
  end if;
  if exists (select 1 from public.payments where user_id = v_uid and status = 'pending') then
    raise exception 'unpaid payments';
  end if;

  -- 경매에 올리지 않은 작성 중 차량은 지운다 (사진 행 포함)
  perform set_config('app.bypass_guard', 'on', true);
  delete from public.cars c where c.seller_id = v_uid
    and not exists (select 1 from public.auctions a where a.car_id = c.id);
  update public.dealers set status = 'suspended' where id = v_uid;
  perform set_config('app.bypass_guard', 'off', true);

  delete from public.push_subscriptions where user_id = v_uid;
  delete from public.dealer_favorites where dealer_id = v_uid;
  delete from public.notifications where user_id = v_uid;

  -- 거래 기록은 상대방·분쟁 처리를 위해 남기고, 사람을 알 수 있는 정보만 지운다
  update public.profiles set phone = null, full_name = null, deleted_at = now() where id = v_uid;

  -- 로그인 차단: 로그인 식별자를 바꾸고 무기한 정지, 세션 삭제
  update auth.users
  set email = 'deleted-' || v_uid || '@deleted.invalid', phone = null,
      raw_user_meta_data = '{}'::jsonb, banned_until = 'infinity'
  where id = v_uid;
  delete from auth.sessions where user_id = v_uid;
end;
$$;

-- ─────────────────────────────────────────────
-- 5) 새 매물 알림 설정
-- ─────────────────────────────────────────────
alter table public.profiles
  add column notify_new_auction boolean not null default true,
  add column notify_makes text[] not null default '{}';

create or replace function public.on_auction_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_dealer uuid;
  v_make text := (select make from public.cars where id = new.car_id);
  v_car text := public.car_label(new.car_id);
begin
  -- 새 매물 알림을 켠 승인 딜러에게 (제조사를 골랐으면 그 제조사만)
  for v_dealer in
    select d.id from public.dealers d join public.profiles p on p.id = d.id
    where d.status = 'approved' and p.notify_new_auction
      and (cardinality(p.notify_makes) = 0 or v_make = any(p.notify_makes))
  loop
    perform public.notify(v_dealer, 'new_auction', jsonb_build_object('car', v_car), '/dealer/auctions/' || new.id);
  end loop;
  return new;
end;
$$;

revoke execute on function public.complete_payment(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.on_deal_completed_invoice() from public, anon, authenticated;
grant execute on function public.mark_payment_paid(text, uuid, text, text) to anon, authenticated;
