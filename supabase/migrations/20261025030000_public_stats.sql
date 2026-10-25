-- 랜딩 화면용 공개 정보: 최근 낙찰 사례와 서비스 현황
-- 차량 종류·연식·주행거리·거래가만 공개한다 (번호판·사람 정보 없음)

create or replace function public.recent_sales(p_limit int default 6)
returns table (make text, model text, year int, mileage_km int, price bigint, completed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.make, c.model, c.year, c.mileage_km, coalesce(d.final_price, d.agreed_price), d.completed_at
  from public.deals d
  join public.auctions a on a.id = d.auction_id
  join public.cars c on c.id = a.car_id
  where d.status = 'completed'
  order by d.completed_at desc
  limit least(p_limit, 20);
$$;

create or replace function public.public_stats()
returns table (live_auctions int, approved_dealers int, completed_deals int)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*)::int from public.auctions where status = 'live' and ends_at > now()),
    (select count(*)::int from public.dealers where status = 'approved'),
    (select count(*)::int from public.deals where status = 'completed');
$$;

grant execute on function public.recent_sales(int) to anon, authenticated;
grant execute on function public.public_stats() to anon, authenticated;
