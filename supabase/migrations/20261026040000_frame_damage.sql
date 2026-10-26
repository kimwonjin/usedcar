-- 골격 손상 (헤이딜러처럼 외판과 골격을 나눈다)
-- 외판(문·펜더·범퍼 등) 교환·판금은 단순 사고, 골격(필러·휠하우스·사이드멤버·플로어 등) 교환·판금은 큰 사고(유사고).
-- frame_damage = {"부위": "repaired"(판금·용접) | "replaced"(교환)}. 골격 손상이 하나라도 있으면 사고 이력을 자동으로 'major'로 둔다.

alter table public.cars
  add column frame_damage jsonb not null default '{}'::jsonb check (jsonb_typeof(frame_damage) = 'object');

-- 부위·상태 값 검사와 자동 분류 (보호 트리거 cars_guard_fields 다음에 실행되도록 이름을 뒤로)
create or replace function public.classify_frame_damage()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from jsonb_each_text(new.frame_damage) e
    where e.key not in ('front_panel', 'cross_member', 'inside_panel_l', 'inside_panel_r', 'front_side_member_l', 'front_side_member_r', 'front_wheelhouse_l', 'front_wheelhouse_r', 'dash_panel', 'pillar_l', 'pillar_r', 'side_sill_l', 'side_sill_r', 'floor_panel', 'rear_wheelhouse_l', 'rear_wheelhouse_r', 'rear_side_member_l', 'rear_side_member_r', 'trunk_floor', 'rear_panel')
       or e.value not in ('repaired', 'replaced')
  ) then
    raise exception 'invalid frame damage';
  end if;
  if new.frame_damage <> '{}'::jsonb then
    new.accident := 'major';
  end if;
  return new;
end;
$$;

create trigger cars_zz_frame_classify
  before insert or update on public.cars
  for each row execute function public.classify_frame_damage();

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
  -- 표시한 손상(외판·골격)은 경매 중 지울 수 없다. 더 알리는 것(추가)은 된다
  if not (new.damage ?& array(select jsonb_object_keys(old.damage)))
     or not (new.frame_damage ?& array(select jsonb_object_keys(old.frame_damage))) then
    raise exception 'damage marks locked during auction';
  end if;
  return new;
end;
$$;

-- 경매 중 골격 손상을 더 알리면 입찰 딜러에게도 알린다 (외판과 같게)
create or replace function public.on_car_damage_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.damage is distinct from old.damage or new.frame_damage is distinct from old.frame_damage then
    perform public.notify_car_updated(new.id);
  end if;
  return new;
end;
$$;

drop trigger cars_notify_damage on public.cars;
create trigger cars_notify_damage
  after update of damage, frame_damage on public.cars
  for each row execute function public.on_car_damage_changed();

revoke execute on function public.classify_frame_damage() from public, anon, authenticated;
