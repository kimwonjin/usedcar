-- 1:1 문의 (고객센터): 사용자가 문의를 남기면 관리자가 답하고, 답변이 오면 알림을 보낸다.

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('account', 'selling', 'buying', 'payment', 'bug', 'other')),
  subject text not null check (char_length(btrim(subject)) between 1 and 120),
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.support_tickets (user_id, updated_at desc);
create index on public.support_tickets (status, updated_at desc);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  from_admin boolean not null default false,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on public.support_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

create policy "support tickets: own or admin read" on public.support_tickets for select
  using (user_id = auth.uid() or public.is_admin());
create policy "support tickets: create own" on public.support_tickets for insert
  with check (user_id = auth.uid() and status = 'open');
create policy "support tickets: admin update" on public.support_tickets for update
  using (public.is_admin());

create policy "support messages: own ticket or admin read" on public.support_messages for select
  using (public.is_admin() or exists (
    select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()));
-- 닫힌 문의에는 사용자가 더 쓸 수 없다 (관리자는 가능)
create policy "support messages: write to own open ticket or admin" on public.support_messages for insert
  with check (sender_id = auth.uid() and (public.is_admin() or exists (
    select 1 from public.support_tickets t
    where t.id = ticket_id and t.user_id = auth.uid() and t.status <> 'closed')));

-- 관리자 답변 여부는 서버가 정한다 (클라이언트 값 무시)
create or replace function public.before_support_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.from_admin := public.is_admin()
    and not exists (select 1 from public.support_tickets t where t.id = new.ticket_id and t.user_id = new.sender_id);
  return new;
end;
$$;

create trigger support_messages_before
  before insert on public.support_messages
  for each row execute function public.before_support_message();

-- 상태 갱신 + 알림: 관리자 답변 → 문의자에게, 사용자 글 → 관리자에게
create or replace function public.after_support_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_ticket public.support_tickets;
begin
  update public.support_tickets
  set status = case when new.from_admin then 'answered' else 'open' end, updated_at = now()
  where id = new.ticket_id
  returning * into v_ticket;

  if new.from_admin then
    perform public.notify(v_ticket.user_id, 'support_reply', jsonb_build_object('text', v_ticket.subject), '/support/' || v_ticket.id);
  else
    perform public.notify_admins('support_new', jsonb_build_object('text', v_ticket.subject), '/admin/support/' || v_ticket.id);
  end if;
  return new;
end;
$$;

create trigger support_messages_after
  after insert on public.support_messages
  for each row execute function public.after_support_message();

revoke execute on function public.before_support_message() from public, anon, authenticated;
revoke execute on function public.after_support_message() from public, anon, authenticated;
