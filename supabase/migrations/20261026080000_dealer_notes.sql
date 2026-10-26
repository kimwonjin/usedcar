-- 딜러 메모: 경매 차량마다 딜러가 자기만 보는 메모를 남긴다 (예: "범퍼 재도색 의심, 최대 320만").
-- 판매자·다른 딜러·관리자 화면에는 보이지 않는다.

create table public.dealer_notes (
  dealer_id uuid not null references public.dealers (id) on delete cascade,
  auction_id uuid not null references public.auctions (id) on delete cascade,
  body text not null check (length(body) between 1 and 1000),
  updated_at timestamptz not null default now(),
  primary key (dealer_id, auction_id)
);

alter table public.dealer_notes enable row level security;
create policy "dealer notes: own read" on public.dealer_notes for select using (dealer_id = auth.uid());
create policy "dealer notes: own add" on public.dealer_notes for insert with check (dealer_id = auth.uid());
create policy "dealer notes: own edit" on public.dealer_notes for update using (dealer_id = auth.uid()) with check (dealer_id = auth.uid());
create policy "dealer notes: own delete" on public.dealer_notes for delete using (dealer_id = auth.uid());
