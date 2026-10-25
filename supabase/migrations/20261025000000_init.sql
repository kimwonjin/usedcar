-- 알마티 중고차 셀프 경매 MVP 스키마
-- 금액은 모두 텡게(₸) 정수(bigint)로 저장한다.

create extension if not exists pg_cron;

-- ─────────────────────────────────────────────
-- 열거형
-- ─────────────────────────────────────────────
create type public.user_role as enum ('seller', 'dealer', 'admin');
create type public.dealer_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.photo_slot as enum ('front', 'rear', 'left', 'right', 'interior', 'dashboard', 'trunk', 'defect');
-- live: 입찰 중 / ended: 마감, 판매자 결정 대기 / accepted: 판매 결정(거래 생성)
-- rejected: 판매자 거절 / no_bids: 입찰 없이 마감 / cancelled: 관리자 강제 종료·판매자 취소
create type public.auction_status as enum ('live', 'ended', 'accepted', 'rejected', 'no_bids', 'cancelled');
create type public.deal_status as enum ('scheduled', 'depreciation_review', 'completed', 'cancelled');
create type public.claim_status as enum ('submitted', 'approved', 'rejected');

-- ─────────────────────────────────────────────
-- 테이블
-- ─────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'seller',
  full_name text,
  phone text,
  locale text not null default 'ko' check (locale in ('ko', 'ru', 'kk')),
  created_at timestamptz not null default now()
);

create table public.dealers (
  id uuid primary key references public.profiles (id) on delete cascade,
  business_name text not null,
  bin text not null check (bin ~ '^[0-9]{12}$'), -- 카자흐스탄 사업자번호(БИН) 12자리
  address text not null,
  shop_photo_paths text[] not null default '{}',
  status public.dealer_status not null default 'pending',
  rejection_reason text,
  rating numeric(2, 1) not null default 0 check (rating between 0 and 5),
  warning_count int not null default 0,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.cars (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  plate_number text not null,
  make text not null,
  model text not null,
  year int not null check (year between 1960 and 2100),
  mileage_km int not null check (mileage_km >= 0),
  fuel text,
  transmission text,
  body_type text,
  color text,
  engine_volume numeric(3, 1),
  steering text not null default 'left' check (steering in ('left', 'right')), -- 우핸들 수입차가 흔함
  customs_cleared boolean not null default true, -- растаможен 여부
  vin text,
  defects text, -- 판매자가 표시한 하자
  desired_price bigint check (desired_price > 0),
  created_at timestamptz not null default now()
);

create table public.car_photos (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars (id) on delete cascade,
  slot public.photo_slot not null,
  storage_path text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.car_photos (car_id);

create table public.auctions (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  status public.auction_status not null default 'live',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null default now() + interval '48 hours',
  winning_bid_id uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.auctions (status, ends_at);
create index on public.auctions (seller_id);
-- 한 차량에 동시에 하나의 진행 중 경매만
create unique index auctions_one_live_per_car on public.auctions (car_id) where status = 'live';

-- 딜러당 경매 하나에 입찰 하나. 진행 중에는 금액을 올릴 수만 있다.
create table public.bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions (id) on delete cascade,
  dealer_id uuid not null references public.dealers (id) on delete cascade,
  amount bigint not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auction_id, dealer_id)
);
create index on public.bids (auction_id, amount desc);

alter table public.auctions
  add constraint auctions_winning_bid_fk foreign key (winning_bid_id) references public.bids (id);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null unique references public.auctions (id) on delete cascade,
  seller_id uuid not null references public.profiles (id),
  dealer_id uuid not null references public.dealers (id),
  agreed_price bigint not null,
  final_price bigint,
  meeting_at timestamptz,
  meeting_place text,
  status public.deal_status not null default 'scheduled',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 감가 심사: 현장에서 딜러가 감가 사유를 제출하면 관리자가 심사한다.
create table public.depreciation_claims (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  dealer_id uuid not null references public.dealers (id),
  amount bigint not null check (amount > 0),
  reason text not null,
  photo_paths text[] not null default '{}',
  status public.claim_status not null default 'submitted',
  seller_comment text,
  admin_note text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 헬퍼 함수
-- ─────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_approved_dealer()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.dealers where id = auth.uid() and status = 'approved');
$$;

-- 가입 시 프로필 자동 생성 (휴대폰 OTP 로그인)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, phone) values (new.id, new.phone);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 본인이 role을 바꾸지 못하게 막는다. 역할 변경은 관리자 또는 security definer 함수만.
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'role change not allowed';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- 딜러 본인은 심사 관련 필드를 바꾸지 못한다.
create or replace function public.guard_dealer_review_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.rating := 0;
    new.warning_count := 0;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.rejection_reason := null;
  else
    new.status := old.status;
    new.rating := old.rating;
    new.warning_count := old.warning_count;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
    new.rejection_reason := old.rejection_reason;
  end if;
  return new;
end;
$$;

create trigger dealers_guard_review
  before insert or update on public.dealers
  for each row execute function public.guard_dealer_review_fields();

-- 거래 당사자는 일정·장소·상태만 바꿀 수 있다. 금액·당사자는 고정.
create or replace function public.guard_deal_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  new.auction_id := old.auction_id;
  new.seller_id := old.seller_id;
  new.dealer_id := old.dealer_id;
  new.agreed_price := old.agreed_price;
  new.final_price := old.final_price;
  return new;
end;
$$;

create trigger deals_guard_fields
  before update on public.deals
  for each row execute function public.guard_deal_fields();

-- ─────────────────────────────────────────────
-- 비즈니스 로직 (RPC)
-- ─────────────────────────────────────────────

-- 판매자: 경매 시작 (48시간)
create or replace function public.start_auction(p_car_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_auction_id uuid;
begin
  if not exists (select 1 from public.cars where id = p_car_id and seller_id = auth.uid()) then
    raise exception 'car not found';
  end if;
  if (select count(distinct slot) from public.car_photos
      where car_id = p_car_id and slot <> 'defect') < 7 then
    raise exception 'required photos missing';
  end if;

  insert into public.auctions (car_id, seller_id)
  values (p_car_id, auth.uid())
  returning id into v_auction_id;
  return v_auction_id;
end;
$$;

-- 딜러: 입찰 또는 입찰가 올리기. 내 순위를 돌려준다.
create or replace function public.place_bid(p_auction_id uuid, p_amount bigint)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_auction public.auctions;
  v_existing bigint;
begin
  if not public.is_approved_dealer() then
    raise exception 'dealer not approved';
  end if;

  select * into v_auction from public.auctions where id = p_auction_id for update;
  if v_auction.id is null or v_auction.status <> 'live' or v_auction.ends_at <= now() then
    raise exception 'auction not live';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid amount';
  end if;

  select amount into v_existing from public.bids
  where auction_id = p_auction_id and dealer_id = auth.uid();
  if v_existing is not null and p_amount <= v_existing then
    raise exception 'bid can only be raised';
  end if;

  insert into public.bids (auction_id, dealer_id, amount)
  values (p_auction_id, auth.uid(), p_amount)
  on conflict (auction_id, dealer_id)
  do update set amount = excluded.amount, updated_at = now();

  return public.my_bid_rank(p_auction_id);
end;
$$;

-- 딜러: 내 입찰 순위 (다른 딜러의 금액은 보여주지 않는다)
create or replace function public.my_bid_rank(p_auction_id uuid)
returns int language sql stable security definer set search_path = '' as $$
  with mine as (
    select amount from public.bids
    where auction_id = p_auction_id and dealer_id = auth.uid()
  )
  select case when exists (select 1 from mine) then
    1 + (select count(*)::int from public.bids b
         where b.auction_id = p_auction_id and b.amount > (select amount from mine))
  end;
$$;

-- 공개 통계: 입찰 딜러 수. 최고가는 판매자·관리자에게만.
create or replace function public.auction_stats(p_auction_id uuid)
returns table (bid_count int, top_amount bigint)
language sql stable security definer set search_path = '' as $$
  select
    count(*)::int,
    case when exists (select 1 from public.auctions a
                      where a.id = p_auction_id and a.seller_id = auth.uid())
              or public.is_admin()
         then max(b.amount) end
  from public.bids b
  where b.auction_id = p_auction_id;
$$;

-- 판매자: 경매 결과 상위 3위 (딜러 이름·평점)
create or replace function public.auction_top_bids(p_auction_id uuid)
returns table (bid_id uuid, amount bigint, dealer_name text, dealer_rating numeric)
language sql stable security definer set search_path = '' as $$
  select b.id, b.amount, d.business_name, d.rating
  from public.bids b
  join public.dealers d on d.id = b.dealer_id
  join public.auctions a on a.id = b.auction_id
  where b.auction_id = p_auction_id
    and (a.seller_id = auth.uid() or public.is_admin())
  order by b.amount desc, b.created_at
  limit 3;
$$;

-- 판매자: 상위 3위 중 하나를 골라 판매 → 거래 생성
create or replace function public.accept_bid(p_auction_id uuid, p_bid_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_auction public.auctions;
  v_bid public.bids;
  v_deal_id uuid;
begin
  select * into v_auction from public.auctions
  where id = p_auction_id and seller_id = auth.uid() for update;
  if v_auction.id is null or v_auction.status <> 'ended' then
    raise exception 'auction not awaiting decision';
  end if;
  if p_bid_id not in (select bid_id from public.auction_top_bids(p_auction_id)) then
    raise exception 'bid not in top 3';
  end if;

  select * into v_bid from public.bids where id = p_bid_id;

  update public.auctions
  set status = 'accepted', winning_bid_id = v_bid.id, decided_at = now()
  where id = p_auction_id;

  insert into public.deals (auction_id, seller_id, dealer_id, agreed_price)
  values (p_auction_id, auth.uid(), v_bid.dealer_id, v_bid.amount)
  returning id into v_deal_id;
  return v_deal_id;
end;
$$;

-- 판매자: 판매 거절
create or replace function public.reject_auction(p_auction_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.auctions set status = 'rejected', decided_at = now()
  where id = p_auction_id and seller_id = auth.uid() and status = 'ended';
  if not found then
    raise exception 'auction not awaiting decision';
  end if;
end;
$$;

-- 관리자: 딜러 승인·거절·정지
create or replace function public.review_dealer(
  p_dealer_id uuid, p_status public.dealer_status, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  update public.dealers
  set status = p_status, rejection_reason = p_reason,
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_dealer_id;
  update public.profiles
  set role = case when p_status = 'approved' then 'dealer'::public.user_role else 'seller'::public.user_role end
  where id = p_dealer_id and role <> 'admin';
end;
$$;

-- 마감 시간이 지난 경매를 닫는다 (pg_cron이 1분마다 실행)
create or replace function public.close_expired_auctions()
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  update public.auctions a
  set status = case when exists (select 1 from public.bids b where b.auction_id = a.id)
                    then 'ended'::public.auction_status
                    else 'no_bids'::public.auction_status end
  where a.status = 'live' and a.ends_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

select cron.schedule('close-expired-auctions', '* * * * *', 'select public.close_expired_auctions()');

-- 클라이언트에서 직접 부르지 못하게 할 함수
revoke execute on function public.close_expired_auctions() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.dealers enable row level security;
alter table public.cars enable row level security;
alter table public.car_photos enable row level security;
alter table public.auctions enable row level security;
alter table public.bids enable row level security;
alter table public.deals enable row level security;
alter table public.depreciation_claims enable row level security;

-- profiles: 본인, 관리자, 거래 상대방(낙찰 후 연락처 공개)
create policy "profiles: read own, counterpart, admin" on public.profiles for select using (
  id = auth.uid() or public.is_admin()
  or exists (select 1 from public.deals d
             where (d.seller_id = auth.uid() and d.dealer_id = profiles.id)
                or (d.dealer_id = auth.uid() and d.seller_id = profiles.id))
);
create policy "profiles: update own" on public.profiles for update using (id = auth.uid() or public.is_admin());

-- dealers: 본인 신청서 작성·조회, 관리자 전체
create policy "dealers: read own or admin" on public.dealers for select using (id = auth.uid() or public.is_admin());
create policy "dealers: read by deal counterpart" on public.dealers for select using (
  exists (select 1 from public.deals d where d.dealer_id = dealers.id and d.seller_id = auth.uid())
);
create policy "dealers: apply" on public.dealers for insert with check (id = auth.uid());
create policy "dealers: update own or admin" on public.dealers for update using (id = auth.uid() or public.is_admin());

-- cars / photos: 판매자 본인, 승인 딜러(경매에 올라간 차량), 관리자
create policy "cars: seller crud" on public.cars for all using (seller_id = auth.uid()) with check (seller_id = auth.uid());
create policy "cars: dealer/admin read auctioned" on public.cars for select using (
  public.is_admin()
  or (public.is_approved_dealer() and exists (select 1 from public.auctions a where a.car_id = cars.id))
);

create policy "photos: seller crud" on public.car_photos for all
  using (exists (select 1 from public.cars c where c.id = car_id and c.seller_id = auth.uid()))
  with check (exists (select 1 from public.cars c where c.id = car_id and c.seller_id = auth.uid()));
create policy "photos: dealer/admin read auctioned" on public.car_photos for select using (
  public.is_admin()
  or (public.is_approved_dealer() and exists (select 1 from public.auctions a where a.car_id = car_photos.car_id))
);

-- auctions: 판매자 본인, 승인 딜러, 관리자 (생성·상태 변경은 RPC로만)
create policy "auctions: read" on public.auctions for select using (
  seller_id = auth.uid() or public.is_approved_dealer() or public.is_admin()
);
create policy "auctions: admin update" on public.auctions for update using (public.is_admin());

-- bids: 딜러는 내 입찰만, 판매자는 내 경매의 입찰, 관리자 전체 (작성은 place_bid로만)
create policy "bids: read" on public.bids for select using (
  dealer_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.auctions a where a.id = auction_id and a.seller_id = auth.uid())
);

-- deals: 당사자와 관리자
create policy "deals: read parties" on public.deals for select using (
  seller_id = auth.uid() or dealer_id = auth.uid() or public.is_admin()
);
create policy "deals: update parties" on public.deals for update using (
  seller_id = auth.uid() or dealer_id = auth.uid() or public.is_admin()
);

-- 감가 청구: 딜러가 작성, 당사자 조회, 판매자 의견, 관리자 심사
create policy "claims: read parties" on public.depreciation_claims for select using (
  dealer_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.deals d where d.id = deal_id and d.seller_id = auth.uid())
);
create policy "claims: dealer submit" on public.depreciation_claims for insert with check (
  dealer_id = auth.uid()
  and status = 'submitted'
  and exists (select 1 from public.deals d where d.id = deal_id and d.dealer_id = auth.uid())
);
create policy "claims: admin review" on public.depreciation_claims for update using (public.is_admin());

-- ─────────────────────────────────────────────
-- Realtime: 최고가·입찰 수 실시간 갱신
-- ─────────────────────────────────────────────
alter publication supabase_realtime add table public.auctions, public.bids;

-- ─────────────────────────────────────────────
-- Storage
-- 경로 규칙: car-photos/{seller_id}/{car_id}/{slot}-{n}.jpg, dealer-docs/{dealer_id}/...
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('car-photos', 'car-photos', false), ('dealer-docs', 'dealer-docs', false)
on conflict (id) do nothing;

create policy "car-photos: owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'car-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "car-photos: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'car-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "car-photos: read" on storage.objects for select to authenticated
  using (bucket_id = 'car-photos' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_approved_dealer()
    or public.is_admin()
  ));

create policy "dealer-docs: owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'dealer-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "dealer-docs: owner or admin read" on storage.objects for select to authenticated
  using (bucket_id = 'dealer-docs' and (
    (storage.foldername(name))[1] = auth.uid()::text or public.is_admin()
  ));
