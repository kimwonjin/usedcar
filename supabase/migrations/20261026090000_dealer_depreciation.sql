-- 딜러 감가율: 판매자가 딜러를 고를 때 "이 딜러는 방문 뒤 평균 몇 % 깎았는지"를 본다.
-- 완료 거래 기준: (합의가 − 최종가) / 합의가. 높게 입찰하고 방문해서 크게 깎는 딜러를 걸러 내도록.
-- 판매자는 다른 거래를 직접 읽을 수 없으므로 집계 값만 돌려준다 (승인 딜러만).

create or replace function public.dealer_depreciation(p_dealer_ids uuid[])
returns table (dealer_id uuid, deals int, reduced int, avg_rate numeric)
language sql stable security definer set search_path = '' as $$
  select x.dealer_id,
         count(*)::int,
         count(*) filter (where x.final_price < x.agreed_price)::int,
         round(avg(greatest(x.agreed_price - coalesce(x.final_price, x.agreed_price), 0)::numeric / x.agreed_price * 100), 1)
  from public.deals x
  join public.dealers d on d.id = x.dealer_id and d.status = 'approved'
  where x.dealer_id = any(p_dealer_ids) and x.status = 'completed' and x.agreed_price > 0
  group by x.dealer_id;
$$;

revoke execute on function public.dealer_depreciation(uuid[]) from public, anon;
grant execute on function public.dealer_depreciation(uuid[]) to authenticated;
