-- 딜러 새 매물 알림 조건: 제조사에 더해 연식 범위·최대 주행거리·무사고만 (비워 두면 조건 없음)

alter table public.profiles
  add column notify_year_from int check (notify_year_from between 1960 and 2100),
  add column notify_year_to int check (notify_year_to between 1960 and 2100),
  add column notify_max_km int check (notify_max_km > 0),
  add column notify_no_accident boolean not null default false;

create or replace function public.on_auction_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_dealer uuid;
  v_car public.cars;
  v_label text := public.car_label(new.car_id);
begin
  select * into v_car from public.cars where id = new.car_id;
  -- 새 매물 알림을 켠 승인 딜러 중 조건에 맞는 딜러에게
  for v_dealer in
    select d.id from public.dealers d join public.profiles p on p.id = d.id
    where d.status = 'approved' and p.notify_new_auction
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
