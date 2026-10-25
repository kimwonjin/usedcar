-- 경매 문의(Q&A): 진행 중인 경매에 승인 딜러가 질문하면 판매자가 답한다.
-- 질문·답변은 그 경매를 보는 모든 딜러에게 공개되고, 질문한 딜러 이름은 판매자·다른 딜러에게 보이지 않는다.

create table public.auction_questions (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions (id) on delete cascade,
  dealer_id uuid not null references public.dealers (id) on delete cascade,
  question text not null check (char_length(btrim(question)) between 2 and 500),
  answer text check (answer is null or char_length(btrim(answer)) between 1 and 1000),
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.auction_questions (auction_id, created_at);

alter table public.auction_questions enable row level security;

-- 표에서 직접 읽기는 질문한 딜러 본인·관리자만. 다른 사람은 질문자(dealer_id)를 가린 auction_qa 함수로 본다
create policy "questions: own or admin read" on public.auction_questions for select
  using (dealer_id = auth.uid() or public.is_admin());
-- 질문: 승인 딜러, 진행 중인 경매에만, 하루 질문 수 제한은 아래 트리거에서
create policy "questions: dealer ask" on public.auction_questions for insert
  with check (dealer_id = auth.uid() and public.is_approved_dealer() and answer is null
              and exists (select 1 from public.auctions a where a.id = auction_id and a.status = 'live' and a.ends_at > now()));

-- 답변: 판매자 전용 함수로만 (질문 내용은 바꿀 수 없다)
create or replace function public.answer_question(p_question_id uuid, p_answer text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_q public.auction_questions;
  v_car text;
begin
  select q.* into v_q from public.auction_questions q
  join public.auctions a on a.id = q.auction_id
  where q.id = p_question_id and a.seller_id = auth.uid() and a.status in ('live', 'ended');
  if v_q.id is null then
    raise exception 'question not found';
  end if;
  if p_answer is null or char_length(btrim(p_answer)) = 0 then
    raise exception 'empty answer';
  end if;
  update public.auction_questions set answer = btrim(p_answer), answered_at = now() where id = p_question_id;

  v_car := public.car_label((select car_id from public.auctions where id = v_q.auction_id));
  perform public.notify(v_q.dealer_id, 'question_answered', jsonb_build_object('car', v_car, 'text', left(btrim(p_answer), 80)),
                        '/dealer/auctions/' || v_q.auction_id);
end;
$$;

-- 질문이 오면 판매자에게 알림 + 같은 경매에 딜러 1명당 질문 5개까지 (도배 방지)
create or replace function public.on_question_asked()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_auction public.auctions;
begin
  if (select count(*) from public.auction_questions where auction_id = new.auction_id and dealer_id = new.dealer_id) >= 5 then
    raise exception 'too many questions';
  end if;
  select * into v_auction from public.auctions where id = new.auction_id;
  perform public.notify(v_auction.seller_id, 'question_asked',
    jsonb_build_object('car', public.car_label(v_auction.car_id), 'text', left(btrim(new.question), 80)),
    '/sell/auctions/' || v_auction.id);
  return new;
end;
$$;

create trigger auction_questions_asked
  before insert on public.auction_questions
  for each row execute function public.on_question_asked();

-- 화면용 목록: 질문한 딜러 이름 대신 "내 질문인지"만 알려준다
create or replace function public.auction_qa(p_auction_id uuid)
returns table (id uuid, question text, answer text, answered_at timestamptz, created_at timestamptz, mine boolean)
language sql stable security definer set search_path = '' as $$
  select q.id, q.question, q.answer, q.answered_at, q.created_at, q.dealer_id = auth.uid()
  from public.auction_questions q
  where q.auction_id = p_auction_id
    and (public.is_approved_dealer() or public.is_admin()
         or exists (select 1 from public.auctions a where a.id = p_auction_id and a.seller_id = auth.uid()))
  order by q.created_at;
$$;

revoke execute on function public.on_question_asked() from public, anon, authenticated;
revoke execute on function public.answer_question(uuid, text) from public, anon;
revoke execute on function public.auction_qa(uuid) from public, anon;
grant execute on function public.answer_question(uuid, text) to authenticated;
grant execute on function public.auction_qa(uuid) to authenticated;
