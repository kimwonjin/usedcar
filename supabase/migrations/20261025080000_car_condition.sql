-- 차량 상태표: 옵션, 사고 이력, 소유자 수, 부위별 외판 상태(흠집·찌그러짐·도색·교환)
-- 딜러가 입찰 전에 정확히 보고, 현장 감가 분쟁을 줄이기 위한 정보

alter table public.cars
  add column options text[] not null default '{}',
  add column accident text check (accident in ('none', 'minor', 'major')),
  add column owners int check (owners between 1 and 20),
  -- {"hood": "painted", "fl_door": "scratch"} 처럼 부위 → 상태
  add column damage jsonb not null default '{}'::jsonb
    check (jsonb_typeof(damage) = 'object');

-- 경매 중에는 옵션·사고 이력·소유자 수를 바꿀 수 없고, 표시한 외판 부위를 지울 수 없다 (추가·변경만 가능)
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
  if not (new.damage ?& array(select jsonb_object_keys(old.damage))) then
    raise exception 'damage marks locked during auction';
  end if;
  return new;
end;
$$;

-- 외판 상태를 보강하면 입찰·찜 딜러에게 알림 (하자 설명과 같은 방식)
create or replace function public.on_car_damage_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.damage is distinct from old.damage then
    perform public.notify_car_updated(new.id);
  end if;
  return new;
end;
$$;

create trigger cars_notify_damage
  after update of damage on public.cars
  for each row execute function public.on_car_damage_changed();

revoke execute on function public.on_car_damage_changed() from public, anon, authenticated;
