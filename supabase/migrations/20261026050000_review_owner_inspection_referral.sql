-- 출시 전 신뢰·성장 기능 묶음
-- 1) 경매 검수: 판매자가 경매를 신청하면 운영팀이 사진·정보를 확인하고 승인해야 경매가 시작된다 (설정으로 끄면 바로 시작)
-- 2) 소유자 확인: 차량등록증(техпаспорт) 사진. 관리자와 거래가 정해진 딜러만 본다. 확인되면 딜러 화면에 배지
-- 3) 딜러 현장 점검표: 만남 현장에서 항목별 점검. 감가 청구는 점검표에 문제 항목이 있어야 할 수 있다
-- 4) 친구 추천: 추천 코드로 가입한 판매자가 첫 거래를 마치면 양쪽에 보상 기록 (실제 지급은 결제 연동 후)

-- ─────────────────────────────────────────────
-- 1) 경매 검수 + 2) 소유자 확인: 차량 칸
-- ─────────────────────────────────────────────
alter table public.cars
  add column review_status text check (review_status in ('pending', 'approved', 'rejected')),
  add column review_note text check (review_note is null or char_length(review_note) <= 500),
  add column submitted_at timestamptz,
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references public.profiles (id),
  add column registration_doc_paths text[] not null default '{}',
  add column owner_verified_at timestamptz;

insert into public.app_settings (key, value) values ('auction_review', 'on'), ('referral_reward', '5000')
on conflict (key) do nothing;

-- 검수·소유자 확인 칸은 판매자가 직접 바꾸지 못한다. 등록증 사진을 바꾸면 소유자 확인은 다시 받아야 한다
-- (보호 트리거 cars_guard_fields 다음에 실행되도록 이름을 뒤로)
create or replace function public.protect_car_review()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_admin() or public.guard_bypassed() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.review_status := null;
    new.review_note := null;
    new.submitted_at := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.owner_verified_at := null;
  else
    new.review_status := old.review_status;
    new.review_note := old.review_note;
    new.submitted_at := old.submitted_at;
    new.reviewed_at := old.reviewed_at;
    new.reviewed_by := old.reviewed_by;
    new.owner_verified_at := case when new.registration_doc_paths is distinct from old.registration_doc_paths
                                  then null else old.owner_verified_at end;
    -- 검수 중에는 등록증 외 정보도 운영팀이 보고 있으므로 바꿀 수 없게 하지는 않되, 반려 사유는 남긴다
  end if;
  return new;
end;
$$;

create trigger cars_zz_protect_review
  before insert or update on public.cars
  for each row execute function public.protect_car_review();

-- 경매를 실제로 만드는 내부 함수 (판매자 신청·관리자 승인 공용). 사진·중복 번호판·진행 중 한도를 확인한다
create or replace function public.create_auction_for(p_car_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_car public.cars;
  v_plate text;
  v_auction_id uuid;
begin
  select * into v_car from public.cars where id = p_car_id;
  v_plate := upper(regexp_replace(v_car.plate_number, '[^0-9A-Za-z]', '', 'g'));
  if exists (
    select 1 from unnest(array['front', 'rear', 'left', 'right', 'interior', 'dashboard', 'trunk']) as required(slot)
    where not exists (select 1 from public.car_photos p where p.car_id = p_car_id and p.slot::text = required.slot)
  ) then
    raise exception 'required photos missing';
  end if;
  if exists (
    select 1 from public.auctions a join public.cars c on c.id = a.car_id
    where upper(regexp_replace(c.plate_number, '[^0-9A-Za-z]', '', 'g')) = v_plate
      and (a.status in ('live', 'ended')
           or (a.status = 'accepted'
               and exists (select 1 from public.deals d where d.auction_id = a.id and d.status in ('scheduled', 'depreciation_review'))))
  ) then
    raise exception 'plate already listed';
  end if;
  if (select count(*) from public.auctions where seller_id = v_car.seller_id and status in ('live', 'ended')) >= 3 then
    raise exception 'too many active auctions';
  end if;

  insert into public.auctions (car_id, seller_id) values (p_car_id, v_car.seller_id)
  returning id into v_auction_id;
  return v_auction_id;
end;
$$;

-- 판매자: 경매 신청. 검수가 켜져 있으면 검수 대기로 두고 null을 돌려준다 (승인되면 알림)
create or replace function public.start_auction(p_car_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_car public.cars;
  v_plate text;
begin
  select * into v_car from public.cars where id = p_car_id and seller_id = auth.uid() for update;
  if v_car.id is null then
    raise exception 'car not found';
  end if;
  if coalesce(public.setting('auction_review'), 'on') <> 'on' or public.is_admin() then
    return public.create_auction_for(p_car_id);
  end if;

  if v_car.review_status = 'pending' then
    raise exception 'already submitted';
  end if;
  -- 신청 단계에서 미리 막을 수 있는 것은 미리 알려준다
  if exists (
    select 1 from unnest(array['front', 'rear', 'left', 'right', 'interior', 'dashboard', 'trunk']) as required(slot)
    where not exists (select 1 from public.car_photos p where p.car_id = p_car_id and p.slot::text = required.slot)
  ) then
    raise exception 'required photos missing';
  end if;
  v_plate := upper(regexp_replace(v_car.plate_number, '[^0-9A-Za-z]', '', 'g'));
  if exists (
    select 1 from public.cars c
    where c.id <> p_car_id and c.review_status = 'pending'
      and upper(regexp_replace(c.plate_number, '[^0-9A-Za-z]', '', 'g')) = v_plate
  ) or exists (
    select 1 from public.auctions a join public.cars c on c.id = a.car_id
    where upper(regexp_replace(c.plate_number, '[^0-9A-Za-z]', '', 'g')) = v_plate
      and (a.status in ('live', 'ended')
           or (a.status = 'accepted'
               and exists (select 1 from public.deals d where d.auction_id = a.id and d.status in ('scheduled', 'depreciation_review'))))
  ) then
    raise exception 'plate already listed';
  end if;
  if (select count(*) from public.auctions where seller_id = auth.uid() and status in ('live', 'ended'))
     + (select count(*) from public.cars where seller_id = auth.uid() and review_status = 'pending') >= 3 then
    raise exception 'too many active auctions';
  end if;

  perform set_config('app.bypass_guard', 'on', true);
  update public.cars set review_status = 'pending', review_note = null, submitted_at = now(), reviewed_at = null, reviewed_by = null
  where id = p_car_id;
  perform set_config('app.bypass_guard', 'off', true);
  perform public.notify_admins('admin_listing_review', jsonb_build_object('car', public.car_label(p_car_id)), '/admin/review');
  return null;
end;
$$;

-- 관리자: 승인 → 경매 시작 (등록증을 확인했으면 소유자 확인도 함께)
create or replace function public.approve_listing(p_car_id uuid, p_owner_verified boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_car public.cars;
  v_auction_id uuid;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  select * into v_car from public.cars where id = p_car_id and review_status = 'pending' for update;
  if v_car.id is null then
    raise exception 'listing not pending';
  end if;
  v_auction_id := public.create_auction_for(p_car_id);
  update public.cars
  set review_status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(), review_note = null,
      owner_verified_at = case when p_owner_verified and cardinality(registration_doc_paths) > 0 then now() else owner_verified_at end
  where id = p_car_id;
  perform public.notify(v_car.seller_id, 'listing_approved', jsonb_build_object('car', public.car_label(p_car_id)),
                        '/sell/auctions/' || v_auction_id);
  return v_auction_id;
end;
$$;

-- 관리자: 반려 (사유를 판매자에게 알려 주고, 판매자가 고쳐서 다시 신청한다)
create or replace function public.reject_listing(p_car_id uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_car public.cars;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  if p_note is null or char_length(btrim(p_note)) < 2 then
    raise exception 'note required';
  end if;
  select * into v_car from public.cars where id = p_car_id and review_status = 'pending' for update;
  if v_car.id is null then
    raise exception 'listing not pending';
  end if;
  update public.cars set review_status = 'rejected', review_note = btrim(p_note), reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_car_id;
  perform public.notify(v_car.seller_id, 'listing_rejected',
                        jsonb_build_object('car', public.car_label(p_car_id), 'text', left(btrim(p_note), 120)), '/sell');
end;
$$;

-- 관리자: 소유자 확인만 따로 (검수를 끈 경우나 경매 중에 등록증을 올린 경우)
create or replace function public.verify_owner(p_car_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  update public.cars set owner_verified_at = now()
  where id = p_car_id and cardinality(registration_doc_paths) > 0;
  if not found then
    raise exception 'no documents';
  end if;
end;
$$;

-- 등록증 사진 버킷: car-docs/{seller_id}/{car_id}/{uuid}.jpg
insert into storage.buckets (id, name, public) values ('car-docs', 'car-docs', false)
on conflict (id) do nothing;

create policy "car-docs: owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'car-docs' and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.cars c where c.id::text = (storage.foldername(name))[2] and c.seller_id = auth.uid()));
create policy "car-docs: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'car-docs' and (storage.foldername(name))[1] = auth.uid()::text);
-- 읽기: 본인, 관리자, 이 차의 거래가 정해진 딜러 (취소된 거래 제외)
create policy "car-docs: read" on storage.objects for select to authenticated
  using (bucket_id = 'car-docs' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
    or exists (select 1 from public.deals d join public.auctions a on a.id = d.auction_id
               where a.car_id::text = (storage.foldername(name))[2] and d.dealer_id = auth.uid() and d.status <> 'cancelled')
  ));

-- ─────────────────────────────────────────────
-- 3) 딜러 현장 점검표
-- ─────────────────────────────────────────────
create table public.deal_inspections (
  deal_id uuid primary key references public.deals (id) on delete cascade,
  dealer_id uuid not null references public.dealers (id),
  items jsonb not null default '{}'::jsonb check (jsonb_typeof(items) = 'object'),
  note text check (note is null or char_length(note) <= 1000),
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deal_inspections enable row level security;
create policy "inspections: parties read" on public.deal_inspections for select using (
  public.is_admin()
  or exists (select 1 from public.deals d where d.id = deal_id and (d.seller_id = auth.uid() or d.dealer_id = auth.uid()))
);
create policy "inspections: dealer write" on public.deal_inspections for insert with check (
  dealer_id = auth.uid()
  and exists (select 1 from public.deals d where d.id = deal_id and d.dealer_id = auth.uid()
              and d.status in ('scheduled', 'depreciation_review'))
);
create policy "inspections: dealer update" on public.deal_inspections for update using (
  dealer_id = auth.uid()
  and exists (select 1 from public.deals d where d.id = deal_id and d.dealer_id = auth.uid()
              and d.status in ('scheduled', 'depreciation_review'))
) with check (dealer_id = auth.uid());

-- 항목·값 검사, 처음 제출하면 판매자에게 알림
create or replace function public.on_inspection_saved()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_deal public.deals;
begin
  if exists (
    select 1 from jsonb_each_text(new.items) e
    where e.key not in ('exterior', 'interior', 'engine', 'transmission', 'underbody', 'tires', 'electronics', 'documents', 'mileage', 'keys')
       or e.value not in ('ok', 'issue')
  ) then
    raise exception 'invalid inspection';
  end if;
  new.updated_at := now();
  if tg_op = 'INSERT' then
    select * into v_deal from public.deals where id = new.deal_id;
    perform public.notify(v_deal.seller_id, 'inspection_done',
      jsonb_build_object('car', public.car_label((select car_id from public.auctions where id = v_deal.auction_id))),
      '/sell/deals/' || v_deal.id);
  end if;
  return new;
end;
$$;

create trigger deal_inspections_saved
  before insert or update on public.deal_inspections
  for each row execute function public.on_inspection_saved();

-- 감가 청구: 점검표에 문제 항목이 하나 이상 있어야 한다 (거래가 미만, 사진 1~6장 규칙은 그대로)
drop policy "claims: dealer submit" on public.depreciation_claims;
create policy "claims: dealer submit" on public.depreciation_claims for insert with check (
  dealer_id = auth.uid()
  and status = 'submitted'
  and cardinality(photo_paths) between 1 and 6
  and exists (select 1 from public.deals d
              where d.id = deal_id and d.dealer_id = auth.uid() and d.status = 'scheduled'
                and amount < d.agreed_price)
  and exists (select 1 from public.deal_inspections i
              where i.deal_id = depreciation_claims.deal_id
                and exists (select 1 from jsonb_each_text(i.items) e where e.value = 'issue'))
);

-- ─────────────────────────────────────────────
-- 4) 친구 추천
-- ─────────────────────────────────────────────
alter table public.profiles
  add column referral_code text unique,
  add column referred_by uuid references public.profiles (id),
  add column referred_at timestamptz;

-- 헷갈리는 글자(0·O·1·I)를 뺀 6자리 코드
create or replace function public.new_referral_code()
returns text language plpgsql set search_path = '' as $$
declare
  v_code text;
begin
  loop
    v_code := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
               from generate_series(1, 6));
    exit when not exists (select 1 from public.profiles where referral_code = v_code);
  end loop;
  return v_code;
end;
$$;

update public.profiles set referral_code = public.new_referral_code() where referral_code is null;

-- 새 프로필에 코드 부여 + 추천 칸은 사용자가 직접 바꾸지 못한다
create or replace function public.guard_profile_referral()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.referral_code := coalesce(new.referral_code, public.new_referral_code());
    if auth.uid() is not null and not public.is_admin() then
      new.referred_by := null;
      new.referred_at := null;
    end if;
    return new;
  end if;
  if auth.uid() is not null and not public.is_admin() and not public.guard_bypassed() then
    new.referral_code := old.referral_code;
    new.referred_by := old.referred_by;
    new.referred_at := old.referred_at;
  end if;
  return new;
end;
$$;

create trigger profiles_zz_guard_referral
  before insert or update on public.profiles
  for each row execute function public.guard_profile_referral();

create table public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  referee_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('referrer', 'referee')),
  deal_id uuid references public.deals (id) on delete set null,
  amount bigint not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'void')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (referee_id, role)
);
alter table public.referral_rewards enable row level security;
create policy "referral rewards: own or admin read" on public.referral_rewards for select
  using (user_id = auth.uid() or public.is_admin());
create policy "referral rewards: admin update" on public.referral_rewards for update
  using (public.is_admin()) with check (public.is_admin());

-- 가입 직후(7일 안, 아직 경매·거래 없음) 한 번만 추천 코드를 등록한다
create or replace function public.claim_referral(p_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_me public.profiles;
  v_referrer uuid;
begin
  select * into v_me from public.profiles where id = auth.uid() for update;
  if v_me.id is null or v_me.referred_by is not null then
    return false;
  end if;
  select id into v_referrer from public.profiles where referral_code = upper(btrim(p_code)) and deleted_at is null;
  if v_referrer is null or v_referrer = v_me.id then
    return false;
  end if;
  if v_me.created_at < now() - interval '7 days'
     or exists (select 1 from public.auctions where seller_id = v_me.id)
     or exists (select 1 from public.deals where seller_id = v_me.id or dealer_id = v_me.id) then
    return false;
  end if;
  perform set_config('app.bypass_guard', 'on', true);
  update public.profiles set referred_by = v_referrer, referred_at = now() where id = v_me.id;
  perform set_config('app.bypass_guard', 'off', true);
  return true;
end;
$$;

-- 추천받은 판매자의 첫 거래가 완료되면 양쪽에 보상 기록 (실제 지급은 운영팀이 처리 후 '지급 완료'로 바꾼다)
create or replace function public.on_deal_completed_referral()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_referrer uuid;
  v_amount bigint := coalesce(public.setting('referral_reward')::bigint, 0);
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;
  select referred_by into v_referrer from public.profiles where id = new.seller_id;
  if v_referrer is null or v_amount <= 0
     or exists (select 1 from public.referral_rewards where referee_id = new.seller_id) then
    return new;
  end if;
  insert into public.referral_rewards (user_id, referee_id, role, deal_id, amount) values
    (v_referrer, new.seller_id, 'referrer', new.id, v_amount),
    (new.seller_id, new.seller_id, 'referee', new.id, v_amount);
  perform public.notify(v_referrer, 'referral_reward', jsonb_build_object('amount', v_amount), '/account');
  perform public.notify(new.seller_id, 'referral_reward', jsonb_build_object('amount', v_amount), '/account');
  return new;
end;
$$;

create trigger deals_referral_reward
  after update of status on public.deals
  for each row execute function public.on_deal_completed_referral();

-- 내 추천 현황
create or replace function public.my_referral_stats()
returns table (code text, invited int, completed int, pending_amount bigint, paid_amount bigint)
language sql stable security definer set search_path = '' as $$
  select p.referral_code,
         (select count(*)::int from public.profiles x where x.referred_by = p.id),
         (select count(*)::int from public.referral_rewards r where r.user_id = p.id and r.role = 'referrer'),
         coalesce((select sum(amount) from public.referral_rewards r where r.user_id = p.id and r.status = 'pending'), 0)::bigint,
         coalesce((select sum(amount) from public.referral_rewards r where r.user_id = p.id and r.status = 'paid'), 0)::bigint
  from public.profiles p where p.id = auth.uid();
$$;

revoke execute on function public.protect_car_review() from public, anon, authenticated;
revoke execute on function public.create_auction_for(uuid) from public, anon, authenticated;
revoke execute on function public.approve_listing(uuid, boolean) from public, anon;
revoke execute on function public.reject_listing(uuid, text) from public, anon;
revoke execute on function public.verify_owner(uuid) from public, anon;
revoke execute on function public.on_inspection_saved() from public, anon, authenticated;
revoke execute on function public.new_referral_code() from public, anon, authenticated;
revoke execute on function public.guard_profile_referral() from public, anon, authenticated;
revoke execute on function public.claim_referral(text) from public, anon;
revoke execute on function public.on_deal_completed_referral() from public, anon, authenticated;
revoke execute on function public.my_referral_stats() from public, anon;
grant execute on function public.approve_listing(uuid, boolean) to authenticated;
grant execute on function public.reject_listing(uuid, text) to authenticated;
grant execute on function public.verify_owner(uuid) to authenticated;
grant execute on function public.claim_referral(text) to authenticated;
grant execute on function public.my_referral_stats() to authenticated;
