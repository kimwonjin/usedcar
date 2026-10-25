-- 만남 일정 리마인더 (헤이딜러처럼)
-- 1) 만남 2시간 전: 판매자·딜러 모두에게 시간·장소 알림
-- 2) 만남 시간이 3시간 지났는데 거래가 아직 진행 중이면 판매자에게 "완료 처리" 안내 한 번
-- 만남 시간을 바꾸면 알림을 다시 보낼 수 있게 기록을 지운다

alter table public.deals
  add column meeting_reminded_at timestamptz,
  add column complete_nudged_at timestamptz;

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
  new.meeting_reminded_at := old.meeting_reminded_at;
  new.complete_nudged_at := old.complete_nudged_at;
  return new;
end;
$$;

create or replace function public.reset_meeting_reminder()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.meeting_at is distinct from old.meeting_at then
    new.meeting_reminded_at := null;
    new.complete_nudged_at := null;
  end if;
  return new;
end;
$$;

-- 보호 트리거(deals_guard_fields) 다음에 실행되도록 이름을 뒤로
create trigger deals_zz_meeting_reset
  before update of meeting_at on public.deals
  for each row execute function public.reset_meeting_reminder();

create or replace function public.process_meeting_reminders()
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_deal public.deals;
  v_car text;
  v_params jsonb;
  v_count int := 0;
begin
  perform set_config('app.bypass_guard', 'on', true);

  for v_deal in
    select * from public.deals
    where status in ('scheduled', 'depreciation_review') and meeting_at is not null and meeting_reminded_at is null
      and meeting_at > now() and meeting_at <= now() + interval '2 hours'
    for update skip locked
  loop
    v_car := public.car_label((select car_id from public.auctions where id = v_deal.auction_id));
    v_params := jsonb_build_object('car', v_car, 'at', v_deal.meeting_at, 'place', coalesce(v_deal.meeting_place, ''));
    perform public.notify(v_deal.seller_id, 'meeting_reminder', v_params, '/sell/deals/' || v_deal.id);
    perform public.notify(v_deal.dealer_id, 'meeting_reminder', v_params, '/dealer/deals/' || v_deal.id);
    update public.deals set meeting_reminded_at = now() where id = v_deal.id;
    v_count := v_count + 1;
  end loop;

  for v_deal in
    select * from public.deals
    where status = 'scheduled' and meeting_at is not null and complete_nudged_at is null
      and meeting_at <= now() - interval '3 hours'
    for update skip locked
  loop
    v_car := public.car_label((select car_id from public.auctions where id = v_deal.auction_id));
    perform public.notify(v_deal.seller_id, 'complete_nudge', jsonb_build_object('car', v_car), '/sell/deals/' || v_deal.id);
    update public.deals set complete_nudged_at = now() where id = v_deal.id;
    v_count := v_count + 1;
  end loop;

  perform set_config('app.bypass_guard', 'off', true);
  return v_count;
end;
$$;

select cron.schedule('process-meeting-reminders', '*/10 * * * *', 'select public.process_meeting_reminders()');

revoke execute on function public.reset_meeting_reminder() from public, anon, authenticated;
revoke execute on function public.process_meeting_reminders() from public, anon, authenticated;
