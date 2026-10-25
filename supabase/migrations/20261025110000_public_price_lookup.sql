-- 무료 시세 조회: 로그인 없이 제조사·모델·연식으로 최근 낙찰가를 본다 (랜딩 유입용).
-- 개인정보 없이 차량·금액·날짜만 공개한다 (최근 판매 목록 recent_sales 와 같은 수준).

grant execute on function public.estimate_price(text, text, int) to anon;

-- 비교 거래: 같은 제조사·모델, 연식 ±2년의 최근 완료 거래
create or replace function public.comparable_sales(p_make text, p_model text, p_year int, p_limit int default 5)
returns table (year int, mileage_km int, price bigint, completed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.year, c.mileage_km, coalesce(d.final_price, d.agreed_price), d.completed_at
  from public.deals d
  join public.auctions a on a.id = d.auction_id
  join public.cars c on c.id = a.car_id
  where d.status = 'completed'
    and lower(c.make) = lower(p_make) and lower(c.model) = lower(p_model)
    and c.year between p_year - 2 and p_year + 2
  order by d.completed_at desc
  limit least(greatest(p_limit, 1), 10);
$$;

grant execute on function public.comparable_sales(text, text, int, int) to anon, authenticated;
