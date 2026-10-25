-- 낙찰 이후 흐름: 거래 진행, 감가 심사, 거래 완료, 딜러 평가
-- 그리고 딜러 재신청, 관리자 경매 강제 종료

-- ─────────────────────────────────────────────
-- 보호 트리거 우회 플래그
-- security definer 함수 안에서도 auth.uid()는 호출한 사용자라서, 함수가 정당하게 바꾸는 값까지
-- 보호 트리거가 되돌려 버린다. 함수 안에서만 이 플래그를 켜서 통과시킨다(트랜잭션 범위).
-- ─────────────────────────────────────────────
create or replace function public.guard_bypassed()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(current_setting('app.bypass_guard', true), '') = 'on';
$$;

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
  else
    -- 거절된 딜러가 신청서를 고쳐 저장하면 다시 심사 대기로
    new.status := case when old.status = 'rejected' then 'pending'::public.dealer_status else old.status end;
    new.rejection_reason := case when old.status = 'rejected' then null else old.rejection_reason end;
    new.rating := old.rating;
    new.warning_count := old.warning_count;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
  end if;
  return new;
end;
$$;

-- 거래 당사자는 만남 일정·장소만 바꿀 수 있다. 상태·금액은 함수로만.
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
  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- 딜러 평가 (거래 완료 후 판매자가 1~5점)
-- ─────────────────────────────────────────────
alter table public.deals
  add column seller_rating smallint check (seller_rating between 1 and 5),
  add column seller_review text;

-- 감가 청구가 들어오면 거래를 심사 중으로
create or replace function public.on_claim_submitted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.bypass_guard', 'on', true);
  update public.deals set status = 'depreciation_review'
  where id = new.deal_id and status = 'scheduled';
  perform set_config('app.bypass_guard', 'off', true);
  return new;
end;
$$;

create trigger claims_after_insert
  after insert on public.depreciation_claims
  for each row execute function public.on_claim_submitted();

-- 딜러는 일정이 잡힌(심사 중이 아닌) 거래에만 감가를 청구할 수 있다
drop policy "claims: dealer submit" on public.depreciation_claims;
create policy "claims: dealer submit" on public.depreciation_claims for insert with check (
  dealer_id = auth.uid()
  and status = 'submitted'
  and exists (select 1 from public.deals d
              where d.id = deal_id and d.dealer_id = auth.uid() and d.status = 'scheduled')
);

-- 판매자: 감가 청구에 의견 남기기
create or replace function public.comment_claim(p_claim_id uuid, p_comment text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.depreciation_claims c set seller_comment = p_comment
  from public.deals d
  where c.id = p_claim_id and d.id = c.deal_id and d.seller_id = auth.uid()
    and c.status = 'submitted';
  if not found then
    raise exception 'claim not found';
  end if;
end;
$$;

-- 관리자: 감가 승인·거절
create or replace function public.review_claim(p_claim_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_deal_id uuid;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  update public.depreciation_claims
  set status = case when p_approve then 'approved'::public.claim_status else 'rejected'::public.claim_status end,
      admin_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_claim_id and status = 'submitted'
  returning deal_id into v_deal_id;
  if v_deal_id is null then
    raise exception 'claim not pending';
  end if;
  -- 남은 심사가 없으면 거래를 다시 진행 상태로
  if not exists (select 1 from public.depreciation_claims
                 where deal_id = v_deal_id and status = 'submitted') then
    update public.deals set status = 'scheduled'
    where id = v_deal_id and status = 'depreciation_review';
  end if;
end;
$$;

-- 판매자: 거래 완료 (차량 인도·대금 수령 확인). 최종가 = 낙찰가 - 승인된 감가
create or replace function public.complete_deal(p_deal_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.bypass_guard', 'on', true);
  update public.deals d
  set status = 'completed',
      completed_at = now(),
      final_price = d.agreed_price - coalesce((
        select sum(amount) from public.depreciation_claims
        where deal_id = d.id and status = 'approved'), 0)
  where d.id = p_deal_id and d.seller_id = auth.uid() and d.status = 'scheduled';
  if not found then
    raise exception 'deal not completable';
  end if;
  perform set_config('app.bypass_guard', 'off', true);
end;
$$;

-- 판매자 또는 관리자: 거래 취소
create or replace function public.cancel_deal(p_deal_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.bypass_guard', 'on', true);
  update public.deals set status = 'cancelled'
  where id = p_deal_id and status in ('scheduled', 'depreciation_review')
    and (seller_id = auth.uid() or public.is_admin());
  if not found then
    raise exception 'deal not cancellable';
  end if;
  perform set_config('app.bypass_guard', 'off', true);
end;
$$;

-- 판매자: 완료된 거래의 딜러 평가 → 딜러 평점은 평가 평균
create or replace function public.rate_dealer(p_deal_id uuid, p_rating int, p_review text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_dealer_id uuid;
begin
  perform set_config('app.bypass_guard', 'on', true);
  update public.deals set seller_rating = p_rating, seller_review = p_review
  where id = p_deal_id and seller_id = auth.uid() and status = 'completed' and seller_rating is null
  returning dealer_id into v_dealer_id;
  if v_dealer_id is null then
    raise exception 'deal not rateable';
  end if;
  update public.dealers set rating = (
    select round(avg(seller_rating), 1) from public.deals
    where dealer_id = v_dealer_id and seller_rating is not null)
  where id = v_dealer_id;
  perform set_config('app.bypass_guard', 'off', true);
end;
$$;

-- 관리자: 경매 강제 종료
create or replace function public.admin_cancel_auction(p_auction_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  update public.auctions set status = 'cancelled', decided_at = now()
  where id = p_auction_id and status in ('live', 'ended');
  if not found then
    raise exception 'auction not cancellable';
  end if;
end;
$$;

-- 판매자: 진행 중인 내 경매 취소 (입찰이 들어오기 전만)
create or replace function public.cancel_my_auction(p_auction_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.auctions a set status = 'cancelled', decided_at = now()
  where a.id = p_auction_id and a.seller_id = auth.uid() and a.status = 'live'
    and not exists (select 1 from public.bids b where b.auction_id = a.id);
  if not found then
    raise exception 'auction not cancellable';
  end if;
end;
$$;

-- ─────────────────────────────────────────────
-- 목록·결과 화면용 조회 함수
-- ─────────────────────────────────────────────
create or replace function public.dealer_completed_deals(p_dealer_id uuid)
returns int language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.deals where dealer_id = p_dealer_id and status = 'completed';
$$;

-- 경매 목록의 입찰 딜러 수 (금액은 주지 않는다)
create or replace function public.auction_bid_counts(p_auction_ids uuid[])
returns table (auction_id uuid, bid_count int)
language sql stable security definer set search_path = '' as $$
  select a.id, (select count(*)::int from public.bids b where b.auction_id = a.id)
  from public.auctions a
  where a.id = any(p_auction_ids)
    and (a.seller_id = auth.uid() or public.is_approved_dealer() or public.is_admin());
$$;

-- 경매 결과 상위 3위: 딜러 id와 완료 거래 수를 더한다 (판매자 화면 S7)
drop function public.auction_top_bids(uuid);
create function public.auction_top_bids(p_auction_id uuid)
returns table (bid_id uuid, amount bigint, dealer_id uuid, dealer_name text, dealer_rating numeric, completed_deals int)
language sql stable security definer set search_path = '' as $$
  select b.id, b.amount, d.id, d.business_name, d.rating,
         (select count(*)::int from public.deals x where x.dealer_id = d.id and x.status = 'completed')
  from public.bids b
  join public.dealers d on d.id = b.dealer_id
  join public.auctions a on a.id = b.auction_id
  where b.auction_id = p_auction_id
    and (a.seller_id = auth.uid() or public.is_admin())
  order by b.amount desc, b.created_at
  limit 3;
$$;

-- ─────────────────────────────────────────────
-- 감가 사진 버킷: 딜러가 올리고, 해당 거래의 판매자와 관리자가 본다
-- 경로: claim-photos/{dealer_id}/{deal_id}/{uuid}.jpg
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('claim-photos', 'claim-photos', false)
on conflict (id) do nothing;

create policy "claim-photos: dealer write" on storage.objects for insert to authenticated
  with check (bucket_id = 'claim-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "claim-photos: read" on storage.objects for select to authenticated
  using (bucket_id = 'claim-photos' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
    or exists (select 1 from public.deals d
               where d.id::text = (storage.foldername(name))[2] and d.seller_id = auth.uid())
  ));

-- 관리자는 딜러 신청서의 매장 사진, 판매자 차량 사진을 모두 본다 (기존 정책에 포함)
-- 거래 중인 판매자는 낙찰 딜러의 감가 사진을 본다 (위 정책)

revoke execute on function public.on_claim_submitted() from public, anon, authenticated;
