-- 판매 결과 공유: 거래를 마친 판매자가 "딜러 N곳이 경쟁해 ○○ ₸에 팔았어요" 링크를 공유한다.
-- 링크를 받은 사람(로그인 전 포함)은 차종·연식·주행거리·판매가·경쟁 딜러 수만 본다.
-- 번호판·VIN·이름·연락처·딜러 정보는 내보내지 않는다.

create or replace function public.public_sale(p_deal_id uuid)
returns table (make text, model text, year int, mileage_km int, price bigint, bidders int, completed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.make, c.model, c.year, c.mileage_km, coalesce(d.final_price, d.agreed_price),
         (select count(*)::int from public.bids b where b.auction_id = a.id),
         d.completed_at
  from public.deals d
  join public.auctions a on a.id = d.auction_id
  join public.cars c on c.id = a.car_id
  where d.id = p_deal_id and d.status = 'completed';
$$;

grant execute on function public.public_sale(uuid) to anon, authenticated;
