-- 1) 거래 채팅 사진: 만남 장소·서류·차 상태 사진을 주고받는다. body에는 저장 경로를 넣는다
--    chat-photos/{보낸 사람 id}/{거래 id}/{uuid}.jpg — 거래 당사자와 관리자만 본다
-- 2) 딜러 등급: 평점·완료 거래·딜러 책임 취소(최근 180일)로 판매자가 딜러를 고를 때 참고할 등급

alter table public.deal_messages drop constraint deal_messages_kind_check;
alter table public.deal_messages add constraint deal_messages_kind_check check (kind in ('text', 'phone', 'photo'));

drop policy "messages: parties send text" on public.deal_messages;
create policy "messages: parties send" on public.deal_messages for insert with check (
  sender_id = auth.uid()
  and (kind = 'text'
       or (kind = 'photo' and body like auth.uid()::text || '/' || deal_id::text || '/%'))
  and exists (select 1 from public.deals d
              where d.id = deal_id and d.status <> 'cancelled'
                and (d.seller_id = auth.uid() or d.dealer_id = auth.uid()))
);

insert into storage.buckets (id, name, public) values ('chat-photos', 'chat-photos', false)
on conflict (id) do nothing;

create policy "chat-photos: party write" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-photos' and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.deals d
                where d.id::text = (storage.foldername(name))[2] and d.status <> 'cancelled'
                  and (d.seller_id = auth.uid() or d.dealer_id = auth.uid())));
create policy "chat-photos: party read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-photos' and (
    public.is_admin()
    or exists (select 1 from public.deals d
               where d.id::text = (storage.foldername(name))[2] and (d.seller_id = auth.uid() or d.dealer_id = auth.uid()))
  ));

create or replace function public.on_deal_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_deal public.deals;
  v_recipient uuid;
  v_url text;
  v_car text;
begin
  select * into v_deal from public.deals where id = new.deal_id;
  if new.sender_id = v_deal.seller_id then
    v_recipient := v_deal.dealer_id;
    v_url := '/dealer/deals/' || v_deal.id;
  else
    v_recipient := v_deal.seller_id;
    v_url := '/sell/deals/' || v_deal.id;
  end if;

  if exists (select 1 from public.notifications
             where user_id = v_recipient and type = 'new_message' and url = v_url and read_at is null) then
    return new;
  end if;

  v_car := public.car_label((select car_id from public.auctions where id = v_deal.auction_id));
  perform public.notify(v_recipient, 'new_message',
    jsonb_build_object('car', v_car, 'text', case new.kind when 'phone' then '📞' when 'photo' then '📷' else left(new.body, 60) end),
    v_url);
  return new;
end;
$$;

-- 딜러 등급 (승인 딜러만): top 우수 / trusted 신뢰 / new 신규 / standard 일반 / caution 취소 이력 주의
create or replace function public.dealer_grades(p_dealer_ids uuid[])
returns table (dealer_id uuid, grade text)
language sql stable security definer set search_path = '' as $$
  with s as (
    select d.id, d.rating,
           (select count(*) from public.deals x where x.dealer_id = d.id and x.status = 'completed') as completed,
           (select count(*) from public.deals x
            where x.dealer_id = d.id and x.status = 'cancelled'
              and x.cancel_reason in ('dealer_no_show', 'dealer_cancelled')
              and x.created_at > now() - interval '180 days'
              -- 운영팀이 철회한 패널티의 거래는 빼 준다
              and not exists (select 1 from public.dealer_penalties p
                              where p.deal_id = x.id and p.revoked_at is not null)) as cancels
    from public.dealers d
    where d.id = any(p_dealer_ids) and d.status = 'approved'
  )
  select id,
         case
           when cancels >= 2 then 'caution'
           when completed >= 5 and rating >= 4.5 and cancels = 0 then 'top'
           when completed >= 1 and rating >= 4.0 then 'trusted'
           when completed = 0 and cancels = 0 then 'new'
           else 'standard'
         end
  from s;
$$;

revoke execute on function public.dealer_grades(uuid[]) from public, anon;
grant execute on function public.dealer_grades(uuid[]) to authenticated;
