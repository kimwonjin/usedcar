-- 경매 결과 공개와 희망가 알림 (헤이딜러처럼)
-- 1) 다른 딜러에게 팔린 경매: 입찰했던 딜러가 낙찰가·내 순위·참여 딜러 수를 본다 (누가 낙찰했는지는 비공개)
-- 2) 최고가가 판매자 희망가를 처음 넘으면 판매자에게 알림

create or replace function public.auction_result(p_auction_id uuid)
returns table (winning_amount bigint, my_amount bigint, my_rank int, bidders int)
language sql stable security definer set search_path = '' as $$
  with ranked as (
    select b.dealer_id, b.amount, row_number() over (order by b.amount desc, b.created_at)::int as rank
    from public.bids b where b.auction_id = p_auction_id
  )
  select w.amount, m.amount, m.rank, (select count(*)::int from ranked)
  from public.auctions a
  join public.bids w on w.id = a.winning_bid_id
  join ranked m on m.dealer_id = auth.uid()
  where a.id = p_auction_id and a.status = 'accepted';
$$;

revoke execute on function public.auction_result(uuid) from public, anon;
grant execute on function public.auction_result(uuid) to authenticated;

create or replace function public.on_bid_placed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_auction public.auctions;
  v_car text;
  v_other_dealer uuid;
  v_other_amount bigint;
  v_desired bigint;
  v_prev_max bigint;
begin
  select * into v_auction from public.auctions where id = new.auction_id;
  v_car := public.car_label(v_auction.car_id);

  if tg_op = 'INSERT' and (select count(*) from public.bids where auction_id = new.auction_id) = 1 then
    perform public.notify(v_auction.seller_id, 'first_bid',
      jsonb_build_object('car', v_car, 'amount', new.amount), '/sell/auctions/' || new.auction_id);
  end if;

  -- 최고가가 판매자 희망가를 처음 넘으면 판매자에게 알림
  select desired_price into v_desired from public.cars where id = v_auction.car_id;
  if v_desired is not null and new.amount >= v_desired then
    select max(amount) into v_prev_max from public.bids where auction_id = new.auction_id and id <> new.id;
    if tg_op = 'UPDATE' then
      v_prev_max := greatest(v_prev_max, old.amount);
    end if;
    if v_prev_max is null or v_prev_max < v_desired then
      perform public.notify(v_auction.seller_id, 'desired_reached',
        jsonb_build_object('car', v_car, 'amount', new.amount), '/sell/auctions/' || new.auction_id);
    end if;
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

create or replace function public.on_auction_status_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_car text := public.car_label(new.car_id);
  v_winner uuid;
  v_win_amount bigint;
  v_dealer uuid;
  v_rank int;
begin
  if new.status = old.status then
    return new;
  end if;

  if old.status = 'live' and new.status = 'ended' then
    perform public.notify(new.seller_id, 'auction_ended', jsonb_build_object('car', v_car), '/sell/auctions/' || new.id);
  elsif old.status = 'live' and new.status = 'no_bids' then
    perform public.notify(new.seller_id, 'auction_no_bids', jsonb_build_object('car', v_car), '/sell/auctions/' || new.id);
  elsif new.status = 'expired' then
    perform public.notify(new.seller_id, 'auction_expired', jsonb_build_object('car', v_car), '/sell/auctions/' || new.id);
  elsif new.status = 'cancelled' and auth.uid() is distinct from new.seller_id then
    perform public.notify(new.seller_id, 'auction_cancelled', jsonb_build_object('car', v_car), '/sell/auctions/' || new.id);
  end if;

  -- 판매 결정·거절·취소·기한 초과 시 낙찰받지 못한 딜러에게 결과 알림
  -- 다른 딜러에게 팔렸으면 낙찰가와 내 순위를 함께 알려준다 (다음 입찰 참고용)
  if new.status in ('accepted', 'rejected', 'cancelled', 'expired') and old.status in ('live', 'ended') then
    select dealer_id, amount into v_winner, v_win_amount from public.bids where id = new.winning_bid_id;
    for v_dealer, v_rank in
      select b.dealer_id, (row_number() over (order by b.amount desc, b.created_at))::int
      from public.bids b where b.auction_id = new.id
    loop
      if v_dealer is distinct from v_winner then
        if new.status = 'accepted' then
          perform public.notify(v_dealer, 'auction_lost',
            jsonb_build_object('car', v_car, 'amount', v_win_amount, 'rank', v_rank), '/dealer/auctions/' || new.id);
        else
          perform public.notify(v_dealer, 'auction_closed', jsonb_build_object('car', v_car), '/dealer/auctions/' || new.id);
        end if;
      end if;
    end loop;
  end if;
  return new;
end;
$$;

create or replace function public.push_category(p_type text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_type in ('new_auction', 'ending_soon', 'outbid', 'first_bid', 'car_updated', 'question_asked', 'question_answered',
                    'desired_reached', 'auction_lost') then 'auction'
    when p_type = 'new_message' then 'chat'
    when p_type = 'price_watch' then 'price'
    else 'important'
  end;
$$;
