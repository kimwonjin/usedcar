-- 명의 이전 확인: 거래 완료 후 딜러가 기한 안에 명의 이전(재등록) 증빙 사진을 올린다.
-- 판매자는 완료 여부를 확인하고, 기한이 지나면 딜러·판매자·관리자에게 알린다.
-- (판매 후 과태료·차량세가 판매자에게 계속 나오는 문제를 막기 위함)

alter table public.deals
  add column transfer_due_at timestamptz,
  add column transfer_doc_paths text[] not null default '{}',
  add column transfer_submitted_at timestamptz,
  add column transfer_reminded_at timestamptz,
  add column transfer_overdue_at timestamptz;

insert into public.app_settings (key, value) values ('transfer_due_days', '10')
on conflict (key) do nothing;

-- 이미 완료된 거래에도 기한을 매긴다
update public.deals
set transfer_due_at = completed_at + make_interval(days => 10)
where status = 'completed' and transfer_due_at is null and completed_at is not null;

-- 명의 이전 칸도 함수로만 바꾼다
create or replace function public.guard_deal_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_admin() or public.guard_bypassed() then
    return new;
  end if;
  new.auction_id := old.auction_id;
  new.seller_id := old.seller_id;
  new.dealer_id := old.dealer_id;
  new.agreed_price := old.agreed_price;
  new.final_price := old.final_price;
  new.status := old.status;
  new.completed_at := old.completed_at;
  new.seller_rating := old.seller_rating;
  new.seller_review := old.seller_review;
  new.cancel_reason := old.cancel_reason;
  new.cancelled_by := old.cancelled_by;
  new.transfer_due_at := old.transfer_due_at;
  new.transfer_doc_paths := old.transfer_doc_paths;
  new.transfer_submitted_at := old.transfer_submitted_at;
  new.transfer_reminded_at := old.transfer_reminded_at;
  new.transfer_overdue_at := old.transfer_overdue_at;
  return new;
end;
$$;

-- 거래가 완료되면 명의 이전 기한을 정한다 (보호 트리거 다음에 실행되도록 이름 순서 t > g)
create or replace function public.set_transfer_due()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' and old.status <> 'completed' and new.transfer_due_at is null then
    new.transfer_due_at := now() + make_interval(days => coalesce(public.setting('transfer_due_days')::int, 10));
  end if;
  return new;
end;
$$;

create trigger deals_transfer_due
  before update of status on public.deals
  for each row execute function public.set_transfer_due();

-- 증빙 사진 버킷: transfer-docs/{dealer_id}/{deal_id}/{uuid}.jpg
insert into storage.buckets (id, name, public)
values ('transfer-docs', 'transfer-docs', false)
on conflict (id) do nothing;

create policy "transfer-docs: dealer write" on storage.objects for insert to authenticated
  with check (bucket_id = 'transfer-docs' and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.deals d
                where d.id::text = (storage.foldername(name))[2] and d.dealer_id = auth.uid() and d.status = 'completed'));
create policy "transfer-docs: read" on storage.objects for select to authenticated
  using (bucket_id = 'transfer-docs' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
    or exists (select 1 from public.deals d
               where d.id::text = (storage.foldername(name))[2] and d.seller_id = auth.uid())
  ));

-- 딜러: 명의 이전 증빙 제출 → 판매자에게 알림
create or replace function public.submit_transfer_docs(p_deal_id uuid, p_paths text[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_deal public.deals;
  v_prefix text := auth.uid()::text || '/' || p_deal_id::text || '/';
begin
  select * into v_deal from public.deals where id = p_deal_id and dealer_id = auth.uid() for update;
  if v_deal.id is null or v_deal.status <> 'completed' then
    raise exception 'deal not completed';
  end if;
  if coalesce(cardinality(p_paths), 0) = 0 or cardinality(p_paths) > 6
     or exists (select 1 from unnest(p_paths) p where left(p, length(v_prefix)) <> v_prefix) then
    raise exception 'invalid documents';
  end if;

  perform set_config('app.bypass_guard', 'on', true);
  update public.deals
  set transfer_doc_paths = p_paths, transfer_submitted_at = now()
  where id = p_deal_id;
  perform set_config('app.bypass_guard', 'off', true);

  perform public.notify(v_deal.seller_id, 'transfer_done',
    jsonb_build_object('car', public.car_label((select car_id from public.auctions where id = v_deal.auction_id))),
    '/sell/deals/' || v_deal.id);
end;
$$;

-- 기한 2일 전 딜러에게 미리 알림, 기한이 지나면 딜러·판매자·관리자에게 한 번 알림 (pg_cron 매시간)
create or replace function public.process_transfer_deadlines()
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_deal public.deals;
  v_car text;
  v_count int := 0;
begin
  perform set_config('app.bypass_guard', 'on', true);

  for v_deal in
    select * from public.deals
    where status = 'completed' and transfer_submitted_at is null and transfer_reminded_at is null
      and transfer_due_at - interval '2 days' <= now() and transfer_due_at > now()
    for update skip locked
  loop
    v_car := public.car_label((select car_id from public.auctions where id = v_deal.auction_id));
    perform public.notify(v_deal.dealer_id, 'transfer_reminder', jsonb_build_object('car', v_car), '/dealer/deals/' || v_deal.id);
    update public.deals set transfer_reminded_at = now() where id = v_deal.id;
    v_count := v_count + 1;
  end loop;

  for v_deal in
    select * from public.deals
    where status = 'completed' and transfer_submitted_at is null and transfer_overdue_at is null
      and transfer_due_at <= now()
    for update skip locked
  loop
    v_car := public.car_label((select car_id from public.auctions where id = v_deal.auction_id));
    perform public.notify(v_deal.dealer_id, 'transfer_overdue', jsonb_build_object('car', v_car), '/dealer/deals/' || v_deal.id);
    perform public.notify(v_deal.seller_id, 'transfer_overdue_seller', jsonb_build_object('car', v_car), '/sell/deals/' || v_deal.id);
    perform public.notify_admins('transfer_overdue_admin', jsonb_build_object('car', v_car), '/admin/transfers');
    update public.deals set transfer_overdue_at = now() where id = v_deal.id;
    v_count := v_count + 1;
  end loop;

  perform set_config('app.bypass_guard', 'off', true);
  return v_count;
end;
$$;

select cron.schedule('process-transfer-deadlines', '7 * * * *', 'select public.process_transfer_deadlines()');

revoke execute on function public.set_transfer_due() from public, anon, authenticated;
revoke execute on function public.process_transfer_deadlines() from public, anon, authenticated;
revoke execute on function public.submit_transfer_docs(uuid, text[]) from public, anon;
grant execute on function public.submit_transfer_docs(uuid, text[]) to authenticated;
