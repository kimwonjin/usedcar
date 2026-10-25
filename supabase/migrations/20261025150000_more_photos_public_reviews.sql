-- 1) 선택 사진 칸 추가: 엔진룸, 타이어(최대 4장), 뒷좌석 — 딜러가 상태를 더 정확히 보고 입찰하도록
-- 2) 경매 시작 조건을 "필수 7칸이 모두 있는가"로 정확히 확인 (선택 칸으로 필수 칸을 대신하지 못하게)
-- 3) 랜딩용 최근 판매자 후기 (로그인 없이, 개인정보 없이)

alter type public.photo_slot add value if not exists 'engine';
alter type public.photo_slot add value if not exists 'tires';
alter type public.photo_slot add value if not exists 'rear_seat';

create or replace function public.start_auction(p_car_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_auction_id uuid;
begin
  if not exists (select 1 from public.cars where id = p_car_id and seller_id = auth.uid()) then
    raise exception 'car not found';
  end if;
  if exists (
    select 1 from unnest(array['front', 'rear', 'left', 'right', 'interior', 'dashboard', 'trunk']) as required(slot)
    where not exists (select 1 from public.car_photos p where p.car_id = p_car_id and p.slot::text = required.slot)
  ) then
    raise exception 'required photos missing';
  end if;

  insert into public.auctions (car_id, seller_id)
  values (p_car_id, auth.uid())
  returning id into v_auction_id;
  return v_auction_id;
end;
$$;

create or replace function public.recent_reviews(p_limit int default 6)
returns table (rating smallint, review text, car text, dealer text, reviewed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select x.seller_rating, btrim(x.seller_review), public.car_label(a.car_id), d.business_name,
         coalesce(x.completed_at, x.created_at)
  from public.deals x
  join public.auctions a on a.id = x.auction_id
  join public.dealers d on d.id = x.dealer_id
  where x.seller_rating is not null and nullif(btrim(x.seller_review), '') is not null and d.status = 'approved'
  order by coalesce(x.completed_at, x.created_at) desc
  limit least(greatest(p_limit, 1), 12);
$$;

grant execute on function public.recent_reviews(int) to anon, authenticated;
