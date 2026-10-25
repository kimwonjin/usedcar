-- 공지사항: 관리자가 점검·휴무·이벤트 등을 올리면 앱 상단 배너와 공지 목록에 보인다.
-- 대상(전체·판매자·딜러)과 게시 기간을 정할 수 있고, 언어별 제목·내용을 따로 쓴다.

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  audience text not null default 'all' check (audience in ('all', 'sellers', 'dealers')),
  title jsonb not null check (jsonb_typeof(title) = 'object'),   -- {"ko": "...", "ru": "...", "kk": "..."}
  body jsonb not null default '{}'::jsonb check (jsonb_typeof(body) = 'object'),
  link text check (link is null or link ~ '^/[A-Za-z0-9/_?=&.-]*$'),  -- 앱 안 주소만
  pinned boolean not null default false,  -- 상단 배너로도 보여줄지
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.announcements (starts_at desc);

alter table public.announcements enable row level security;

-- 게시 기간 안의 공지는 누구나(로그인 전 포함) 읽는다. 대상 구분은 화면에서 한다 (비밀 정보가 아님)
create policy "announcements: read published" on public.announcements for select
  using ((starts_at <= now() and (ends_at is null or ends_at > now())) or public.is_admin());
create policy "announcements: admin write" on public.announcements for all
  using (public.is_admin()) with check (public.is_admin());

grant select on public.announcements to anon;
