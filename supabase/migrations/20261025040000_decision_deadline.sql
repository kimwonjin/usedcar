-- 판매 결정 기한: 경매 종료 후 24시간
-- 12시간째에 판매자에게 알림, 24시간이 지나도 결정하지 않으면 '기한 초과'로 종료

alter type public.auction_status add value if not exists 'expired';

alter table public.auctions add column decision_reminded boolean not null default false;

-- 판매자: 상위 3곳 중 하나를 골라 판매 (기한 확인 추가)
create or replace function public.accept_bid(p_auction_id uuid, p_bid_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_auction public.auctions;
  v_bid public.bids;
  v_deal_id uuid;
begin
  select * into v_auction from public.auctions
  where id = p_auction_id and seller_id = auth.uid() for update;
  if v_auction.id is null or v_auction.status <> 'ended' then
    raise exception 'auction not awaiting decision';
  end if;
  if now() > v_auction.ends_at + interval '24 hours' then
    raise exception 'decision deadline passed';
  end if;
  if p_bid_id not in (select bid_id from public.auction_top_bids(p_auction_id)) then
    raise exception 'bid not in top 3';
  end if;

  select * into v_bid from public.bids where id = p_bid_id;

  update public.auctions
  set status = 'accepted', winning_bid_id = v_bid.id, decided_at = now()
  where id = p_auction_id;

  insert into public.deals (auction_id, seller_id, dealer_id, agreed_price)
  values (p_auction_id, auth.uid(), v_bid.dealer_id, v_bid.amount)
  returning id into v_deal_id;
  return v_deal_id;
end;
$$;

-- 12시간 알림 + 24시간 초과 종료 (pg_cron 1분마다)
create or replace function public.process_decision_deadlines()
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_auction public.auctions;
  v_count int := 0;
begin
  for v_auction in
    select * from public.auctions
    where status = 'ended' and not decision_reminded
      and ends_at + interval '12 hours' <= now()
      and ends_at + interval '24 hours' > now()
    for update skip locked
  loop
    perform public.notify(v_auction.seller_id, 'decision_reminder',
      jsonb_build_object('car', public.car_label(v_auction.car_id)), '/sell/auctions/' || v_auction.id);
    update public.auctions set decision_reminded = true where id = v_auction.id;
  end loop;

  update public.auctions
  set status = 'expired', decided_at = now()
  where status = 'ended' and ends_at + interval '24 hours' <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

select cron.schedule('process-decision-deadlines', '* * * * *', 'select public.process_decision_deadlines()');
revoke execute on function public.process_decision_deadlines() from public, anon, authenticated;

-- 상태 변경 알림에 '기한 초과' 추가: 판매자에게 종료 알림, 입찰 딜러에게 결과 알림
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
  elsif new.status = 'expired' then
    perform public.notify(new.seller_id, 'auction_expired', jsonb_build_object('car', v_car), '/sell/auctions/' || new.id);
  elsif new.status = 'cancelled' and auth.uid() is distinct from new.seller_id then
    perform public.notify(new.seller_id, 'auction_cancelled', jsonb_build_object('car', v_car), '/sell/auctions/' || new.id);
  end if;

  -- 판매 결정·거절·취소·기한 초과 시 낙찰받지 못한 딜러에게 결과 알림
  if new.status in ('accepted', 'rejected', 'cancelled', 'expired') and old.status in ('live', 'ended') then
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
