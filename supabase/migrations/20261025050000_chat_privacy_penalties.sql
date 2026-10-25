-- 1) 전화번호 숨김: 거래 상대도 상대의 실제 번호를 조회할 수 없다
-- 2) 거래 채팅: 판매자·딜러가 앱 안에서 대화, 번호는 본인이 보낼 때만 공개
-- 3) 딜러 노쇼·거래 취소 자동 패널티: 1회 경고 → 2회 7일 입찰 제한 → 3회 입찰 정지

-- ─────────────────────────────────────────────
-- 1) 전화번호 숨김
-- ─────────────────────────────────────────────
drop policy "profiles: read own, counterpart, admin" on public.profiles;
create policy "profiles: read own or admin" on public.profiles for select using (id = auth.uid() or public.is_admin());

-- 거래 상대의 표시 이름만 돌려준다 (번호 없음)
create or replace function public.deal_counterpart(p_deal_id uuid)
returns table (name text)
language sql stable security definer set search_path = '' as $$
  select case
    when d.seller_id = auth.uid() then (select business_name from public.dealers where id = d.dealer_id)
    when d.dealer_id = auth.uid() then (select full_name from public.profiles where id = d.seller_id)
  end
  from public.deals d
  where d.id = p_deal_id and (d.seller_id = auth.uid() or d.dealer_id = auth.uid());
$$;

-- ─────────────────────────────────────────────
-- 2) 거래 채팅
-- ─────────────────────────────────────────────
create table public.deal_messages (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  kind text not null default 'text' check (kind in ('text', 'phone')),
  body text not null check (length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index on public.deal_messages (deal_id, created_at);

alter table public.deal_messages enable row level security;

create policy "messages: parties and admin read" on public.deal_messages for select using (
  public.is_admin()
  or exists (select 1 from public.deals d
             where d.id = deal_id and (d.seller_id = auth.uid() or d.dealer_id = auth.uid()))
);
-- 직접 보내는 메시지는 텍스트만. 번호는 share_my_phone으로만 보낸다
create policy "messages: parties send text" on public.deal_messages for insert with check (
  sender_id = auth.uid()
  and kind = 'text'
  and exists (select 1 from public.deals d
              where d.id = deal_id and d.status <> 'cancelled'
                and (d.seller_id = auth.uid() or d.dealer_id = auth.uid()))
);

alter publication supabase_realtime add table public.deal_messages;

-- 내 번호를 상대에게 보내기 (내 프로필 번호를 그대로 메시지로)
create or replace function public.share_my_phone(p_deal_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_phone text;
begin
  if not exists (select 1 from public.deals
                 where id = p_deal_id and status <> 'cancelled'
                   and (seller_id = auth.uid() or dealer_id = auth.uid())) then
    raise exception 'deal not found';
  end if;
  select phone into v_phone from public.profiles where id = auth.uid();
  if v_phone is null then
    raise exception 'no phone';
  end if;
  insert into public.deal_messages (deal_id, sender_id, kind, body) values (p_deal_id, auth.uid(), 'phone', v_phone);
end;
$$;

-- 새 메시지 알림. 같은 거래의 안 읽은 메시지 알림이 이미 있으면 다시 보내지 않는다(연속 메시지 폭탄 방지)
create or replace function public.on_deal_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_deal public.deals;
  v_recipient uuid;
  v_url text;
  v_car text;
begin
  select * into v_deal from public.deals where id = new.deal_id;
  if new.sender_id = v_deal.seller_id then
    v_recipient := v_deal.dealer_id;
    v_url := '/dealer/deals/' || v_deal.id;
  else
    v_recipient := v_deal.seller_id;
    v_url := '/sell/deals/' || v_deal.id;
  end if;

  if exists (select 1 from public.notifications
             where user_id = v_recipient and type = 'new_message' and url = v_url and read_at is null) then
    return new;
  end if;

  v_car := public.car_label((select car_id from public.auctions where id = v_deal.auction_id));
  perform public.notify(v_recipient, 'new_message',
    jsonb_build_object('car', v_car, 'text', case when new.kind = 'phone' then '📞' else left(new.body, 60) end),
    v_url);
  return new;
end;
$$;

create trigger deal_messages_notify
  after insert on public.deal_messages
  for each row execute function public.on_deal_message();

-- ─────────────────────────────────────────────
-- 3) 딜러 패널티
-- ─────────────────────────────────────────────
alter table public.deals
  add column cancel_reason text check (cancel_reason in ('dealer_no_show', 'dealer_cancelled', 'seller_changed_mind', 'other')),
  add column cancelled_by uuid references public.profiles (id);

alter table public.dealers add column bid_blocked_until timestamptz;

create table public.dealer_penalties (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealers (id) on delete cascade,
  deal_id uuid references public.deals (id) on delete set null,
  reason text not null,
  action text not null check (action in ('warning', 'blocked_7d', 'suspended')),
  created_at timestamptz not null default now()
);
alter table public.dealer_penalties enable row level security;
create policy "penalties: dealer own or admin" on public.dealer_penalties for select
  using (dealer_id = auth.uid() or public.is_admin());

-- 상태·금액·취소 정보는 함수로만 바꾼다 (취소 사유 추가)
create or replace function public.guard_deal_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_admin() or public.guard_bypassed() then
    return new;
  end if;
  new.auction_id := old.auction_id;
  new.seller_id := old.seller_id;
  new.dealer_id := old.dealer_id;
  new.agreed_price := old.agreed_price;
  new.final_price := old.final_price;
  new.status := old.status;
  new.completed_at := old.completed_at;
  new.seller_rating := old.seller_rating;
  new.seller_review := old.seller_review;
  new.cancel_reason := old.cancel_reason;
  new.cancelled_by := old.cancelled_by;
  return new;
end;
$$;

-- 패널티 단계: 누적 경고 1회 경고, 2회 7일 입찰 제한, 3회 이상 입찰 정지
create or replace function public.apply_dealer_penalty(p_dealer_id uuid, p_deal_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
  v_action text;
  v_car text;
begin
  perform set_config('app.bypass_guard', 'on', true);
  update public.dealers set warning_count = warning_count + 1
  where id = p_dealer_id returning warning_count into v_count;

  if v_count >= 3 then
    v_action := 'suspended';
    update public.dealers set status = 'suspended' where id = p_dealer_id;
  elsif v_count = 2 then
    v_action := 'blocked_7d';
    update public.dealers set bid_blocked_until = now() + interval '7 days' where id = p_dealer_id;
  else
    v_action := 'warning';
  end if;
  perform set_config('app.bypass_guard', 'off', true);

  insert into public.dealer_penalties (dealer_id, deal_id, reason, action) values (p_dealer_id, p_deal_id, p_reason, v_action);

  v_car := public.car_label((select a.car_id from public.deals d join public.auctions a on a.id = d.auction_id where d.id = p_deal_id));
  if v_action = 'warning' then
    perform public.notify(p_dealer_id, 'penalty_warning', jsonb_build_object('car', v_car), '/dealer/activity');
  elsif v_action = 'blocked_7d' then
    perform public.notify(p_dealer_id, 'penalty_blocked', jsonb_build_object('car', v_car), '/dealer/activity');
  end if;
  -- 정지는 dealers 상태 변경 트리거가 'dealer_suspended' 알림을 보낸다
end;
$$;

-- 거래 취소: 판매자(사유 선택)·딜러(딜러 사정 취소)·관리자. 딜러 책임이면 패널티
drop function public.cancel_deal(uuid);
create function public.cancel_deal(p_deal_id uuid, p_reason text default 'other')
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_deal public.deals;
  v_reason text := p_reason;
begin
  select * into v_deal from public.deals
  where id = p_deal_id and status in ('scheduled', 'depreciation_review')
    and (seller_id = auth.uid() or dealer_id = auth.uid() or public.is_admin())
  for update;
  if v_deal.id is null then
    raise exception 'deal not cancellable';
  end if;
  -- 딜러가 직접 취소하면 사유는 항상 딜러 사정
  if auth.uid() = v_deal.dealer_id then
    v_reason := 'dealer_cancelled';
  end if;
  if v_reason not in ('dealer_no_show', 'dealer_cancelled', 'seller_changed_mind', 'other') then
    raise exception 'invalid reason';
  end if;

  perform set_config('app.bypass_guard', 'on', true);
  update public.deals set status = 'cancelled', cancel_reason = v_reason, cancelled_by = auth.uid()
  where id = p_deal_id;
  perform set_config('app.bypass_guard', 'off', true);

  if v_reason in ('dealer_no_show', 'dealer_cancelled') then
    perform public.apply_dealer_penalty(v_deal.dealer_id, p_deal_id, v_reason);
  end if;
end;
$$;

-- 입찰: 7일 제한 중이면 막는다
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

revoke execute on function public.apply_dealer_penalty(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.on_deal_message() from public, anon, authenticated;
