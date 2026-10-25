-- 알림: 앱 안 알림함 + 웹 푸시
-- 알림은 상태가 바뀌는 순간 DB 트리거가 만든다. 문구는 앱의 번역 파일에서 type·params로 조립한다.

create extension if not exists pg_net;

-- ─────────────────────────────────────────────
-- 테이블
-- ─────────────────────────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  params jsonb not null default '{}',
  url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- 푸시 발송 설정 (발송 URL, 공유 비밀값). 정책이 없어 클라이언트는 읽을 수 없다.
create table public.app_config (
  key text primary key,
  value text not null
);

alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.app_config enable row level security;

create policy "notifications: read own" on public.notifications for select using (user_id = auth.uid());
create policy "notifications: mark read" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "push: own" on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.auctions add column ending_soon_notified boolean not null default false;

alter publication supabase_realtime add table public.notifications;

-- ─────────────────────────────────────────────
-- 알림 생성 + 푸시 발송
-- ─────────────────────────────────────────────
create or replace function public.car_label(p_car_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select make || ' ' || model || ' ' || year from public.cars where id = p_car_id;
$$;

-- 등록된 기기가 있으면 Vercel의 /api/push로 넘긴다. 실패해도 원래 작업은 막지 않는다.
create or replace function public.dispatch_push(p_user uuid, p_type text, p_params jsonb, p_url text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_endpoint text;
  v_secret text;
  v_subs jsonb;
  v_locale text;
begin
  select value into v_endpoint from public.app_config where key = 'push_dispatch_url';
  select value into v_secret from public.app_config where key = 'push_dispatch_secret';
  if v_endpoint is null or v_secret is null then
    return;
  end if;

  select jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth))
  into v_subs from public.push_subscriptions where user_id = p_user;
  if v_subs is null then
    return;
  end if;

  select locale into v_locale from public.profiles where id = p_user;

  begin
    perform net.http_post(
      url := v_endpoint,
      body := jsonb_build_object(
        'locale', coalesce(v_locale, 'ko'), 'type', p_type, 'params', p_params,
        'url', p_url, 'subscriptions', v_subs),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret)
    );
  exception when others then
    null;
  end;
end;
$$;

create or replace function public.notify(p_user uuid, p_type text, p_params jsonb, p_url text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null then
    return;
  end if;
  insert into public.notifications (user_id, type, params, url) values (p_user, p_type, p_params, p_url);
  perform public.dispatch_push(p_user, p_type, p_params, p_url);
end;
$$;

create or replace function public.notify_admins(p_type text, p_params jsonb, p_url text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid;
begin
  for v_admin in select id from public.profiles where role = 'admin' loop
    perform public.notify(v_admin, p_type, p_params, p_url);
  end loop;
end;
$$;

-- /api/push가 만료된 기기를 지울 때 쓴다 (공유 비밀값으로 확인)
create or replace function public.prune_push_subscriptions(p_secret text, p_endpoints text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_secret is distinct from (select value from public.app_config where key = 'push_dispatch_secret') then
    raise exception 'forbidden';
  end if;
  delete from public.push_subscriptions where endpoint = any(p_endpoints);
end;
$$;

-- ─────────────────────────────────────────────
-- 트리거: 경매
-- ─────────────────────────────────────────────
create or replace function public.on_auction_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_dealer uuid;
  v_car text := public.car_label(new.car_id);
begin
  -- 승인된 딜러 전원에게 새 매물 알림
  for v_dealer in select id from public.dealers where status = 'approved' loop
    perform public.notify(v_dealer, 'new_auction', jsonb_build_object('car', v_car), '/dealer/auctions/' || new.id);
  end loop;
  return new;
end;
$$;

create trigger auctions_notify_created
  after insert on public.auctions
  for each row execute function public.on_auction_created();

create or replace function public.on_auction_status_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_car text := public.car_label(new.car_id);
  v_winner uuid;
  v_dealer uuid;
begin
  if new.status = old.status then
    return new;
  end if;

  if old.status = 'live' and new.status = 'ended' then
    perform public.notify(new.seller_id, 'auction_ended', jsonb_build_object('car', v_car), '/sell/auctions/' || new.id);
  elsif old.status = 'live' and new.status = 'no_bids' then
    perform public.notify(new.seller_id, 'auction_no_bids', jsonb_build_object('car', v_car), '/sell/auctions/' || new.id);
  elsif new.status = 'cancelled' and auth.uid() is distinct from new.seller_id then
    perform public.notify(new.seller_id, 'auction_cancelled', jsonb_build_object('car', v_car), '/sell/auctions/' || new.id);
  end if;

  -- 판매 결정·거절·취소 시 낙찰받지 못한 딜러에게 결과 알림 (낙찰 딜러는 거래 생성 알림을 받는다)
  if new.status in ('accepted', 'rejected', 'cancelled') and old.status in ('live', 'ended') then
    select dealer_id into v_winner from public.bids where id = new.winning_bid_id;
    for v_dealer in select dealer_id from public.bids where auction_id = new.id loop
      if v_dealer is distinct from v_winner then
        perform public.notify(v_dealer, 'auction_closed', jsonb_build_object('car', v_car), '/dealer/auctions/' || new.id);
      end if;
    end loop;
  end if;
  return new;
end;
$$;

create trigger auctions_notify_status
  after update of status on public.auctions
  for each row execute function public.on_auction_status_changed();

-- ─────────────────────────────────────────────
-- 트리거: 입찰 (판매자에게 첫 입찰, 1위를 빼앗긴 딜러에게 알림)
-- ─────────────────────────────────────────────
create or replace function public.on_bid_placed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_auction public.auctions;
  v_car text;
  v_other_dealer uuid;
  v_other_amount bigint;
begin
  select * into v_auction from public.auctions where id = new.auction_id;
  v_car := public.car_label(v_auction.car_id);

  if tg_op = 'INSERT' and (select count(*) from public.bids where auction_id = new.auction_id) = 1 then
    perform public.notify(v_auction.seller_id, 'first_bid',
      jsonb_build_object('car', v_car, 'amount', new.amount), '/sell/auctions/' || new.auction_id);
  end if;

  select dealer_id, amount into v_other_dealer, v_other_amount
  from public.bids
  where auction_id = new.auction_id and dealer_id <> new.dealer_id
  order by amount desc, created_at
  limit 1;

  if v_other_dealer is not null and new.amount > v_other_amount
     and (tg_op = 'INSERT' or old.amount <= v_other_amount) then
    perform public.notify(v_other_dealer, 'outbid', jsonb_build_object('car', v_car), '/dealer/auctions/' || new.auction_id);
  end if;
  return new;
end;
$$;

create trigger bids_notify
  after insert or update of amount on public.bids
  for each row execute function public.on_bid_placed();

-- ─────────────────────────────────────────────
-- 트리거: 거래
-- ─────────────────────────────────────────────
create or replace function public.on_deal_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_car_id uuid;
begin
  select car_id into v_car_id from public.auctions where id = new.auction_id;
  perform public.notify(new.dealer_id, 'auction_won',
    jsonb_build_object('car', public.car_label(v_car_id), 'amount', new.agreed_price), '/dealer/deals/' || new.id);
  return new;
end;
$$;

create trigger deals_notify_created
  after insert on public.deals
  for each row execute function public.on_deal_created();

create or replace function public.on_deal_updated()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_car_id uuid;
  v_car text;
begin
  select car_id into v_car_id from public.auctions where id = new.auction_id;
  v_car := public.car_label(v_car_id);

  if (new.meeting_at, new.meeting_place) is distinct from (old.meeting_at, old.meeting_place) then
    if auth.uid() = new.seller_id then
      perform public.notify(new.dealer_id, 'meeting_updated', jsonb_build_object('car', v_car), '/dealer/deals/' || new.id);
    elsif auth.uid() = new.dealer_id then
      perform public.notify(new.seller_id, 'meeting_updated', jsonb_build_object('car', v_car), '/sell/deals/' || new.id);
    end if;
  end if;

  if new.status = 'completed' and old.status <> 'completed' then
    perform public.notify(new.dealer_id, 'deal_completed',
      jsonb_build_object('car', v_car, 'amount', new.final_price), '/dealer/deals/' || new.id);
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    if auth.uid() is distinct from new.dealer_id then
      perform public.notify(new.dealer_id, 'deal_cancelled', jsonb_build_object('car', v_car), '/dealer/deals/' || new.id);
    end if;
    if auth.uid() is distinct from new.seller_id then
      perform public.notify(new.seller_id, 'deal_cancelled', jsonb_build_object('car', v_car), '/sell/deals/' || new.id);
    end if;
  end if;
  return new;
end;
$$;

create trigger deals_notify_updated
  after update on public.deals
  for each row execute function public.on_deal_updated();

-- ─────────────────────────────────────────────
-- 트리거: 감가 청구·심사
-- ─────────────────────────────────────────────
create or replace function public.on_claim_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_deal public.deals;
  v_car text;
  v_params jsonb;
begin
  select * into v_deal from public.deals where id = new.deal_id;
  v_car := public.car_label((select car_id from public.auctions where id = v_deal.auction_id));
  v_params := jsonb_build_object('car', v_car, 'amount', new.amount);

  if tg_op = 'INSERT' then
    perform public.notify(v_deal.seller_id, 'claim_submitted', v_params, '/sell/deals/' || v_deal.id);
    perform public.notify_admins('admin_claim', v_params, '/admin/claims');
  elsif new.status <> old.status and new.status in ('approved', 'rejected') then
    perform public.notify(v_deal.seller_id, 'claim_' || new.status, v_params, '/sell/deals/' || v_deal.id);
    perform public.notify(new.dealer_id, 'claim_' || new.status, v_params, '/dealer/deals/' || v_deal.id);
  end if;
  return new;
end;
$$;

create trigger claims_notify
  after insert or update of status on public.depreciation_claims
  for each row execute function public.on_claim_changed();

-- ─────────────────────────────────────────────
-- 트리거: 딜러 가입·심사
-- ─────────────────────────────────────────────
create or replace function public.on_dealer_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_params jsonb := jsonb_build_object('name', new.business_name);
begin
  if tg_op = 'INSERT' or (old.status = 'rejected' and new.status = 'pending') then
    perform public.notify_admins('admin_dealer_applied', v_params, '/admin/dealers');
  elsif new.status <> old.status then
    if new.status = 'approved' then
      perform public.notify(new.id, 'dealer_approved', v_params, '/dealer');
    elsif new.status = 'rejected' then
      perform public.notify(new.id, 'dealer_rejected', v_params, '/dealer/apply');
    elsif new.status = 'suspended' then
      perform public.notify(new.id, 'dealer_suspended', v_params, '/dealer');
    end if;
  end if;
  return new;
end;
$$;

create trigger dealers_notify
  after insert or update of status on public.dealers
  for each row execute function public.on_dealer_changed();

-- ─────────────────────────────────────────────
-- 마감 1시간 전: 입찰한 딜러에게 (pg_cron 1분마다)
-- ─────────────────────────────────────────────
create or replace function public.notify_ending_auctions()
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_auction public.auctions;
  v_dealer uuid;
  v_count int := 0;
begin
  for v_auction in
    select * from public.auctions
    where status = 'live' and not ending_soon_notified
      and ends_at > now() and ends_at <= now() + interval '1 hour'
    for update skip locked
  loop
    for v_dealer in select dealer_id from public.bids where auction_id = v_auction.id loop
      perform public.notify(v_dealer, 'ending_soon',
        jsonb_build_object('car', public.car_label(v_auction.car_id)), '/dealer/auctions/' || v_auction.id);
    end loop;
    update public.auctions set ending_soon_notified = true where id = v_auction.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

select cron.schedule('notify-ending-auctions', '* * * * *', 'select public.notify_ending_auctions()');

-- 클라이언트에서 직접 부르지 못하게 할 함수
revoke execute on function public.notify(uuid, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.notify_admins(text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.dispatch_push(uuid, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.notify_ending_auctions() from public, anon, authenticated;
revoke execute on function public.on_auction_created() from public, anon, authenticated;
revoke execute on function public.on_auction_status_changed() from public, anon, authenticated;
revoke execute on function public.on_bid_placed() from public, anon, authenticated;
revoke execute on function public.on_deal_created() from public, anon, authenticated;
revoke execute on function public.on_deal_updated() from public, anon, authenticated;
revoke execute on function public.on_claim_changed() from public, anon, authenticated;
revoke execute on function public.on_dealer_changed() from public, anon, authenticated;
