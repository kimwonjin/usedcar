-- 경매 관심도: 차량 상세를 본 딜러 수와 찜한 딜러 수를 판매자에게 보여준다 (누가 봤는지는 공개하지 않음)

create table public.auction_views (
  auction_id uuid not null references public.auctions (id) on delete cascade,
  dealer_id uuid not null references public.dealers (id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  primary key (auction_id, dealer_id)
);

alter table public.auction_views enable row level security;
-- 직접 읽기·쓰기는 막고 아래 함수로만 다룬다
create policy "auction views: admin read" on public.auction_views for select using (public.is_admin());

-- 승인 딜러가 상세를 열면 한 번만 기록
create or replace function public.record_auction_view(p_auction_id uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.auction_views (auction_id, dealer_id)
  select p_auction_id, auth.uid()
  where public.is_approved_dealer()
    and exists (select 1 from public.auctions a where a.id = p_auction_id and a.status = 'live')
  on conflict do nothing;
$$;

-- 판매자(또는 관리자): 본 딜러 수, 찜한 딜러 수
create or replace function public.auction_interest(p_auction_id uuid)
returns table (viewers int, favorites int)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*)::int from public.auction_views where auction_id = p_auction_id),
    (select count(*)::int from public.dealer_favorites where auction_id = p_auction_id)
  where exists (select 1 from public.auctions a where a.id = p_auction_id and (a.seller_id = auth.uid() or public.is_admin()));
$$;

revoke execute on function public.record_auction_view(uuid) from public, anon;
revoke execute on function public.auction_interest(uuid) from public, anon;
grant execute on function public.record_auction_view(uuid) to authenticated;
grant execute on function public.auction_interest(uuid) to authenticated;
