-- 종합 테스트에서 찾은 권한 구멍 막기
-- 1) 딜러가 자기 계정의 입찰 제한(bid_blocked_until)을 직접 지울 수 있던 문제
-- 2) 승인된 딜러가 심사 없이 상호·사업자번호(BIN)를 바꿀 수 있던 문제
-- 3) 딜러가 자기 차 경매에 입찰·질문·찜하고, 자기 차 새 매물 알림을 받던 문제
-- 4) 입찰가 상한이 없어 터무니없는 금액(오타 포함)이 1위가 되던 문제
-- 5) 딜러가 입찰 중이거나 명의 이전을 안 끝낸 채 탈퇴할 수 있던 문제

create or replace function public.guard_dealer_review_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_admin() or public.guard_bypassed() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.rating := 0;
    new.warning_count := 0;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.rejection_reason := null;
    new.bid_blocked_until := null;
  else
    -- 거절된 딜러가 신청서를 고쳐 저장하면 다시 심사 대기로
    new.status := case when old.status = 'rejected' then 'pending'::public.dealer_status else old.status end;
    new.rejection_reason := case when old.status = 'rejected' then null else old.rejection_reason end;
    new.rating := old.rating;
    new.warning_count := old.warning_count;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
    new.bid_blocked_until := old.bid_blocked_until;
    -- 승인 뒤에는 상호·사업자번호를 관리자만 바꾼다
    if old.status = 'approved' then
      new.business_name := old.business_name;
      new.bin := old.bin;
    end if;
  end if;
  return new;
end;
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
  if v_auction.seller_id = auth.uid() then
    raise exception 'own auction';
  end if;
  -- 100억 ₸ 넘는 입찰은 오타로 본다
  if p_amount is null or p_amount <= 0 or p_amount > 10000000000 then
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

drop policy "questions: dealer ask" on public.auction_questions;
create policy "questions: dealer ask" on public.auction_questions for insert
  with check (dealer_id = auth.uid() and public.is_approved_dealer() and answer is null
              and exists (select 1 from public.auctions a
                          where a.id = auction_id and a.status = 'live' and a.ends_at > now() and a.seller_id <> auth.uid()));

drop policy "favorites: own add" on public.dealer_favorites;
create policy "favorites: own add" on public.dealer_favorites for insert
  with check (dealer_id = auth.uid() and public.is_approved_dealer()
              and not exists (select 1 from public.auctions a where a.id = auction_id and a.seller_id = auth.uid()));

create or replace function public.on_auction_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_dealer uuid;
  v_car public.cars;
  v_label text := public.car_label(new.car_id);
begin
  select * into v_car from public.cars where id = new.car_id;
  -- 새 매물 알림을 켠 승인 딜러 중 조건에 맞는 딜러에게 (자기 차는 제외)
  for v_dealer in
    select d.id from public.dealers d join public.profiles p on p.id = d.id
    where d.status = 'approved' and p.notify_new_auction and d.id <> new.seller_id
      and (cardinality(p.notify_makes) = 0 or v_car.make = any(p.notify_makes))
      and (p.notify_year_from is null or v_car.year >= p.notify_year_from)
      and (p.notify_year_to is null or v_car.year <= p.notify_year_to)
      and (p.notify_max_km is null or v_car.mileage_km <= p.notify_max_km)
      and (not p.notify_no_accident or v_car.accident = 'none')
  loop
    perform public.notify(v_dealer, 'new_auction', jsonb_build_object('car', v_label), '/dealer/auctions/' || new.id);
  end loop;
  return new;
end;
$$;

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
  -- 딜러: 판매 결정을 기다리는 경매에 입찰이 있으면 (판매자가 고를 수 있으므로) 먼저 결과를 기다린다
  if exists (select 1 from public.bids b join public.auctions a on a.id = b.auction_id
             where b.dealer_id = v_uid and a.status = 'ended') then
    raise exception 'active auctions';
  end if;
  if exists (select 1 from public.deals where (seller_id = v_uid or dealer_id = v_uid)
             and status in ('scheduled', 'depreciation_review')) then
    raise exception 'active deals';
  end if;
  -- 딜러: 명의 이전 증빙을 아직 내지 않은 완료 거래가 있으면 탈퇴할 수 없다
  if exists (select 1 from public.deals where dealer_id = v_uid and status = 'completed' and transfer_submitted_at is null) then
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
  -- 진행 중인 경매의 입찰은 거둔다 (탈퇴한 딜러가 낙찰 후보로 남지 않게)
  delete from public.bids b using public.auctions a
  where a.id = b.auction_id and b.dealer_id = v_uid and a.status = 'live';
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
