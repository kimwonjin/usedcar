-- 1) 딜러 관심 차량(찜): 마감 1시간 전 알림 대상에 포함
-- 2) 경매 중 판매자 정보 보강: 사진 추가·하자 설명 수정만 허용, 입찰·찜 딜러에게 알림
-- 3) 입찰 기록(판매자 최고가 그래프용)
-- 4) 거래 신고 → 관리자 처리
-- 5) 예상 시세: 같은 차종의 최근 낙찰가

-- ─────────────────────────────────────────────
-- 1) 관심 차량
-- ─────────────────────────────────────────────
create table public.dealer_favorites (
  dealer_id uuid not null references public.dealers (id) on delete cascade,
  auction_id uuid not null references public.auctions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (dealer_id, auction_id)
);
alter table public.dealer_favorites enable row level security;
create policy "favorites: own read" on public.dealer_favorites for select using (dealer_id = auth.uid());
create policy "favorites: own add" on public.dealer_favorites for insert
  with check (dealer_id = auth.uid() and public.is_approved_dealer());
create policy "favorites: own remove" on public.dealer_favorites for delete using (dealer_id = auth.uid());

-- 마감 1시간 전: 입찰한 딜러 + 찜한 딜러
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
    for v_dealer in
      select dealer_id from public.bids where auction_id = v_auction.id
      union
      select dealer_id from public.dealer_favorites where auction_id = v_auction.id
    loop
      perform public.notify(v_dealer, 'ending_soon',
        jsonb_build_object('car', public.car_label(v_auction.car_id)), '/dealer/auctions/' || v_auction.id);
    end loop;
    update public.auctions set ending_soon_notified = true where id = v_auction.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ─────────────────────────────────────────────
-- 2) 경매 중 정보 보강 규칙
-- ─────────────────────────────────────────────
create or replace function public.car_has_active_auction(p_car_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.auctions
                 where car_id = p_car_id and status in ('live', 'ended', 'accepted'));
$$;

-- 경매에 올라간 뒤에는 하자 설명·희망가만 바꿀 수 있다 (주행거리 등을 몰래 바꾸지 못하게)
create or replace function public.guard_car_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_admin() or not public.car_has_active_auction(old.id) then
    return new;
  end if;
  new.seller_id := old.seller_id;
  new.plate_number := old.plate_number;
  new.make := old.make;
  new.model := old.model;
  new.year := old.year;
  new.mileage_km := old.mileage_km;
  new.fuel := old.fuel;
  new.transmission := old.transmission;
  new.body_type := old.body_type;
  new.color := old.color;
  new.engine_volume := old.engine_volume;
  new.steering := old.steering;
  new.customs_cleared := old.customs_cleared;
  new.vin := old.vin;
  return new;
end;
$$;

create trigger cars_guard_fields
  before update on public.cars
  for each row execute function public.guard_car_fields();

-- 경매 기록이 있는 차량은 삭제할 수 없고, 진행 중인 경매의 사진은 지울 수 없다 (불리한 사진 숨기기 방지)
create or replace function public.guard_car_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and exists (select 1 from public.auctions where car_id = old.id) then
    raise exception 'car has auctions';
  end if;
  return old;
end;
$$;

create trigger cars_guard_delete
  before delete on public.cars
  for each row execute function public.guard_car_delete();

create or replace function public.guard_photo_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_admin() and public.car_has_active_auction(old.car_id) then
    raise exception 'photos locked during auction';
  end if;
  return old;
end;
$$;

create trigger car_photos_guard_delete
  before delete on public.car_photos
  for each row execute function public.guard_photo_delete();

-- 진행 중 경매의 사진 추가·하자 수정 → 입찰·찜 딜러에게 알림 (안 읽은 같은 알림이 있으면 생략)
create or replace function public.notify_car_updated(p_car_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_auction public.auctions;
  v_dealer uuid;
  v_url text;
begin
  select * into v_auction from public.auctions where car_id = p_car_id and status = 'live';
  if v_auction.id is null then
    return;
  end if;
  v_url := '/dealer/auctions/' || v_auction.id;
  for v_dealer in
    select dealer_id from public.bids where auction_id = v_auction.id
    union
    select dealer_id from public.dealer_favorites where auction_id = v_auction.id
  loop
    if not exists (select 1 from public.notifications
                   where user_id = v_dealer and type = 'car_updated' and url = v_url and read_at is null) then
      perform public.notify(v_dealer, 'car_updated', jsonb_build_object('car', public.car_label(p_car_id)), v_url);
    end if;
  end loop;
end;
$$;

create or replace function public.on_car_photo_added()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_car_updated(new.car_id);
  return new;
end;
$$;

create trigger car_photos_notify
  after insert on public.car_photos
  for each row execute function public.on_car_photo_added();

create or replace function public.on_car_defects_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.defects is distinct from old.defects then
    perform public.notify_car_updated(new.id);
  end if;
  return new;
end;
$$;

create trigger cars_notify_defects
  after update of defects on public.cars
  for each row execute function public.on_car_defects_changed();

-- ─────────────────────────────────────────────
-- 3) 입찰 기록 (입찰가는 판매자·관리자만 본다)
-- ─────────────────────────────────────────────
create table public.bid_events (
  id bigserial primary key,
  auction_id uuid not null references public.auctions (id) on delete cascade,
  amount bigint not null,
  created_at timestamptz not null default now()
);
create index on public.bid_events (auction_id, created_at);
alter table public.bid_events enable row level security;
create policy "bid events: seller or admin" on public.bid_events for select using (
  public.is_admin()
  or exists (select 1 from public.auctions a where a.id = auction_id and a.seller_id = auth.uid())
);

create or replace function public.on_bid_recorded()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.bid_events (auction_id, amount) values (new.auction_id, new.amount);
  return new;
end;
$$;

create trigger bids_record_event
  after insert or update of amount on public.bids
  for each row execute function public.on_bid_recorded();

-- 기존 입찰은 마지막 금액으로 한 번 채워 둔다
insert into public.bid_events (auction_id, amount, created_at)
select auction_id, amount, updated_at from public.bids;

-- ─────────────────────────────────────────────
-- 4) 거래 신고
-- ─────────────────────────────────────────────
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id),
  target_id uuid not null references public.profiles (id),
  deal_id uuid references public.deals (id) on delete set null,
  reason text not null check (reason in ('fraud', 'no_show', 'rude', 'misleading', 'other')),
  detail text check (length(detail) <= 1000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  admin_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy "reports: reporter or admin read" on public.reports for select
  using (reporter_id = auth.uid() or public.is_admin());
create policy "reports: admin update" on public.reports for update using (public.is_admin());

-- 거래 당사자가 상대를 신고한다
create or replace function public.report_deal(p_deal_id uuid, p_reason text, p_detail text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_deal public.deals;
  v_target uuid;
  v_id uuid;
begin
  select * into v_deal from public.deals
  where id = p_deal_id and (seller_id = auth.uid() or dealer_id = auth.uid());
  if v_deal.id is null then
    raise exception 'deal not found';
  end if;
  v_target := case when v_deal.seller_id = auth.uid() then v_deal.dealer_id else v_deal.seller_id end;

  insert into public.reports (reporter_id, target_id, deal_id, reason, detail)
  values (auth.uid(), v_target, p_deal_id, p_reason, nullif(trim(p_detail), ''))
  returning id into v_id;

  perform public.notify_admins('admin_report', jsonb_build_object('car',
    public.car_label((select car_id from public.auctions where id = v_deal.auction_id))), '/admin/reports');
  return v_id;
end;
$$;

-- ─────────────────────────────────────────────
-- 5) 예상 시세: 같은 제조사·모델, 연식 ±2년의 완료 거래
-- ─────────────────────────────────────────────
create or replace function public.estimate_price(p_make text, p_model text, p_year int)
returns table (sample int, avg_price bigint, min_price bigint, max_price bigint)
language sql stable security definer set search_path = '' as $$
  select count(*)::int,
         round(avg(coalesce(d.final_price, d.agreed_price)))::bigint,
         min(coalesce(d.final_price, d.agreed_price)),
         max(coalesce(d.final_price, d.agreed_price))
  from public.deals d
  join public.auctions a on a.id = d.auction_id
  join public.cars c on c.id = a.car_id
  where d.status = 'completed'
    and lower(c.make) = lower(p_make) and lower(c.model) = lower(p_model)
    and c.year between p_year - 2 and p_year + 2;
$$;

grant execute on function public.estimate_price(text, text, int) to authenticated;

revoke execute on function public.notify_car_updated(uuid) from public, anon, authenticated;
revoke execute on function public.on_car_photo_added() from public, anon, authenticated;
revoke execute on function public.on_car_defects_changed() from public, anon, authenticated;
revoke execute on function public.on_bid_recorded() from public, anon, authenticated;
