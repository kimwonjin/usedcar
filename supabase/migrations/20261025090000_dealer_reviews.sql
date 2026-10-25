-- 딜러 프로필·후기: 판매자가 상위 3곳 중 판매할 딜러를 고를 때 신뢰 정보를 보여준다.
-- 후기에는 판매자 이름 등 개인정보를 담지 않는다 (차량명·별점·후기 글·날짜만).

-- 승인된 딜러의 공개 프로필 (로그인한 사용자만)
create or replace function public.dealer_profile(p_dealer_id uuid)
returns table (
  business_name text,
  rating numeric,
  completed_deals int,
  review_count int,
  approved_at timestamptz,
  dealer_cancellations int
)
language sql stable security definer set search_path = '' as $$
  select
    d.business_name,
    d.rating,
    (select count(*)::int from public.deals x where x.dealer_id = d.id and x.status = 'completed'),
    (select count(*)::int from public.deals x where x.dealer_id = d.id and x.seller_rating is not null),
    d.reviewed_at,
    -- 딜러 노쇼·딜러 사정으로 취소된 거래 수
    (select count(*)::int from public.deals x
     where x.dealer_id = d.id and x.status = 'cancelled'
       and x.cancel_reason in ('dealer_no_show', 'dealer_cancelled'))
  from public.dealers d
  where d.id = p_dealer_id
    and auth.uid() is not null
    and (d.status = 'approved' or d.id = auth.uid() or public.is_admin());
$$;

-- 딜러가 받은 후기 (최신순)
create or replace function public.dealer_reviews(p_dealer_id uuid, p_limit int default 20)
returns table (rating smallint, review text, car text, reviewed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select x.seller_rating, nullif(btrim(x.seller_review), ''), public.car_label(a.car_id), coalesce(x.completed_at, x.created_at)
  from public.deals x
  join public.auctions a on a.id = x.auction_id
  join public.dealers d on d.id = x.dealer_id
  where x.dealer_id = p_dealer_id
    and x.seller_rating is not null
    and auth.uid() is not null
    and (d.status = 'approved' or d.id = auth.uid() or public.is_admin())
  order by coalesce(x.completed_at, x.created_at) desc
  limit least(greatest(p_limit, 1), 50);
$$;

revoke execute on function public.dealer_profile(uuid) from public, anon;
revoke execute on function public.dealer_reviews(uuid, int) from public, anon;
grant execute on function public.dealer_profile(uuid) to authenticated;
grant execute on function public.dealer_reviews(uuid, int) to authenticated;
