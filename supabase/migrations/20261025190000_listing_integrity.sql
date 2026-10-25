-- 매물 무결성: 경매 시작 시
-- 1) 같은 번호판이 이미 경매·거래 중이면 막는다 (남의 차 등록·중복 등록 방지)
-- 2) 한 판매자의 동시 진행 경매(진행 중·결정 대기)는 3대까지 (도배 방지)

create or replace function public.start_auction(p_car_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_auction_id uuid;
  v_plate text;
begin
  select upper(regexp_replace(plate_number, '[^0-9A-Za-z]', '', 'g')) into v_plate
  from public.cars where id = p_car_id and seller_id = auth.uid();
  if v_plate is null then
    raise exception 'car not found';
  end if;
  if exists (
    select 1 from unnest(array['front', 'rear', 'left', 'right', 'interior', 'dashboard', 'trunk']) as required(slot)
    where not exists (select 1 from public.car_photos p where p.car_id = p_car_id and p.slot::text = required.slot)
  ) then
    raise exception 'required photos missing';
  end if;
  if exists (
    select 1 from public.auctions a join public.cars c on c.id = a.car_id
    where upper(regexp_replace(c.plate_number, '[^0-9A-Za-z]', '', 'g')) = v_plate
      and (a.status in ('live', 'ended', 'accepted'))
      and not exists (select 1 from public.deals d where d.auction_id = a.id and d.status in ('completed', 'cancelled'))
  ) then
    raise exception 'plate already listed';
  end if;
  if (select count(*) from public.auctions where seller_id = auth.uid() and status in ('live', 'ended')) >= 3 then
    raise exception 'too many active auctions';
  end if;

  insert into public.auctions (car_id, seller_id)
  values (p_car_id, auth.uid())
  returning id into v_auction_id;
  return v_auction_id;
end;
$$;
