-- 차순위 딜러에게 판매 (헤이딜러처럼)
-- 낙찰 딜러가 노쇼·딜러 사정으로 거래를 취소하면, 판매자는 경매를 다시 하지 않고
-- 경매 종료 7일 안에 남은 입찰 딜러(취소한 딜러 제외, 상위 3곳) 중에서 다시 고를 수 있다.
-- 그래서 "경매 1건 = 거래 1건" 제약을 "경매 1건 = 진행 중·완료 거래 1건"으로 바꾼다 (취소된 거래 기록은 남긴다).

do $$
declare
  v_name text;
begin
  select conname into v_name from pg_constraint
  where conrelid = 'public.deals'::regclass and contype = 'u'
    and conkey = array[(select attnum from pg_attribute where attrelid = 'public.deals'::regclass and attname = 'auction_id')];
  if v_name is not null then
    execute format('alter table public.deals drop constraint %I', v_name);
  end if;
end;
$$;

create unique index deals_one_open_per_auction on public.deals (auction_id) where status <> 'cancelled';
create index deals_auction_id_idx on public.deals (auction_id);

-- 차순위 후보: 이 경매에서 거래를 취소한 딜러를 뺀 승인 딜러 입찰 상위 3곳 (판매자·관리자만)
create or replace function public.reassign_candidates(p_auction_id uuid)
returns table (bid_id uuid, amount bigint, dealer_id uuid, dealer_name text, dealer_rating numeric, completed_deals int)
language sql stable security definer set search_path = '' as $$
  select b.id, b.amount, d.id, d.business_name, d.rating,
         (select count(*)::int from public.deals x where x.dealer_id = d.id and x.status = 'completed')
  from public.bids b
  join public.dealers d on d.id = b.dealer_id
  join public.auctions a on a.id = b.auction_id
  where b.auction_id = p_auction_id
    and d.status = 'approved'
    and not exists (select 1 from public.deals x where x.auction_id = a.id and x.dealer_id = b.dealer_id)
    and (a.seller_id = auth.uid() or public.is_admin())
  order by b.amount desc, b.created_at
  limit 3;
$$;

-- 판매자: 차순위 딜러에게 판매
create or replace function public.reassign_deal(p_auction_id uuid, p_bid_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_auction public.auctions;
  v_last public.deals;
  v_bid public.bids;
  v_deal_id uuid;
begin
  select * into v_auction from public.auctions
  where id = p_auction_id and seller_id = auth.uid() and status = 'accepted' for update;
  if v_auction.id is null then
    raise exception 'auction not reassignable';
  end if;
  if exists (select 1 from public.deals where auction_id = p_auction_id and status <> 'cancelled') then
    raise exception 'deal still open';
  end if;
  select * into v_last from public.deals where auction_id = p_auction_id order by created_at desc limit 1;
  if v_last.id is null or v_last.cancel_reason not in ('dealer_no_show', 'dealer_cancelled') then
    raise exception 'not cancelled by dealer';
  end if;
  if now() > v_auction.ends_at + interval '7 days' then
    raise exception 'reassign window passed';
  end if;
  if p_bid_id not in (select bid_id from public.reassign_candidates(p_auction_id)) then
    raise exception 'bid not eligible';
  end if;

  select * into v_bid from public.bids where id = p_bid_id;
  update public.auctions set winning_bid_id = v_bid.id, decided_at = now() where id = p_auction_id;
  insert into public.deals (auction_id, seller_id, dealer_id, agreed_price)
  values (p_auction_id, auth.uid(), v_bid.dealer_id, v_bid.amount)
  returning id into v_deal_id;
  return v_deal_id;
end;
$$;

revoke execute on function public.reassign_candidates(uuid) from public, anon;
revoke execute on function public.reassign_deal(uuid, uuid) from public, anon;
grant execute on function public.reassign_candidates(uuid) to authenticated;
grant execute on function public.reassign_deal(uuid, uuid) to authenticated;

-- 같은 번호판 중복 등록 검사: 낙찰 경매는 "진행 중인 거래가 있을 때"만 막는다 (취소 후 차순위 거래도 반영)
create or replace function public.start_auction(p_car_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_auction_id uuid;
  v_plate text;
begin
  select upper(regexp_replace(plate_number, '[^0-9A-Za-z]', '', 'g')) into v_plate
  from public.cars where id = p_car_id and seller_id = auth.uid();
  if v_plate is null then
    raise exception 'car not found';
  end if;
  if exists (
    select 1 from unnest(array['front', 'rear', 'left', 'right', 'interior', 'dashboard', 'trunk']) as required(slot)
    where not exists (select 1 from public.car_photos p where p.car_id = p_car_id and p.slot::text = required.slot)
  ) then
    raise exception 'required photos missing';
  end if;
  if exists (
    select 1 from public.auctions a join public.cars c on c.id = a.car_id
    where upper(regexp_replace(c.plate_number, '[^0-9A-Za-z]', '', 'g')) = v_plate
      and (a.status in ('live', 'ended')
           or (a.status = 'accepted'
               and exists (select 1 from public.deals d where d.auction_id = a.id and d.status in ('scheduled', 'depreciation_review'))))
  ) then
    raise exception 'plate already listed';
  end if;
  if (select count(*) from public.auctions where seller_id = auth.uid() and status in ('live', 'ended')) >= 3 then
    raise exception 'too many active auctions';
  end if;

  insert into public.auctions (car_id, seller_id)
  values (p_car_id, auth.uid())
  returning id into v_auction_id;
  return v_auction_id;
end;
$$;
