-- 차량 상태 상세 (헤이딜러처럼): 보조키, 타이어, 휠 스크래치, 외판 스크래치, 정비·수리 필요, 내 차 장점.
-- 딜러가 가격을 정하는 데 직접 쓰는 정보라 선택지로 받는다. 비워 두면 "입력 안 함".
-- 경매 중에는 바꿀 수 없다 (입찰 뒤 차를 좋게 보이게 고치는 것을 막음. 하자 추가는 기존처럼 가능).

alter table public.cars
  add column spare_key boolean,
  add column tire_state text check (tire_state in ('ok', 'front', 'rear', 'all')),
  add column wheel_scratches smallint check (wheel_scratches between 0 and 4),
  add column panel_scratches text check (panel_scratches in ('none', '1_2', '3_4', '5_6', '7_plus')),
  add column repair_needed boolean,
  add column pros text check (pros is null or char_length(pros) <= 500);

create or replace function public.guard_car_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_admin() or not public.car_has_active_auction(old.id) then
    return new;
  end if;
  new.seller_id := old.seller_id;
  new.plate_number := old.plate_number;
  new.make := old.make;
  new.model := old.model;
  new.year := old.year;
  new.mileage_km := old.mileage_km;
  new.fuel := old.fuel;
  new.transmission := old.transmission;
  new.body_type := old.body_type;
  new.color := old.color;
  new.engine_volume := old.engine_volume;
  new.steering := old.steering;
  new.customs_cleared := old.customs_cleared;
  new.vin := old.vin;
  new.options := old.options;
  new.accident := old.accident;
  new.owners := old.owners;
  new.spare_key := old.spare_key;
  new.tire_state := old.tire_state;
  new.wheel_scratches := old.wheel_scratches;
  new.panel_scratches := old.panel_scratches;
  new.repair_needed := old.repair_needed;
  new.pros := old.pros;
  if not (new.damage ?& array(select jsonb_object_keys(old.damage))) then
    raise exception 'damage marks locked during auction';
  end if;
  return new;
end;
$$;
