-- 패널티 관리 (관리자)
-- 1) 패널티 한 건씩 철회: 경고 수를 되돌리고, 7일 제한·정지였으면 풀어 준다. 기록은 남기고 "철회됨"으로 표시
-- 2) 관리자 경고도 같은 단계(경고 → 7일 제한 → 정지)를 거치고 이력에 남는다 (예전 버튼은 숫자만 올렸다)

alter table public.dealer_penalties
  add column note text check (note is null or char_length(note) <= 300),
  add column revoked_at timestamptz,
  add column revoked_by uuid references public.profiles (id),
  add column revoke_note text check (revoke_note is null or char_length(revoke_note) <= 300);

create or replace function public.apply_dealer_penalty(p_dealer_id uuid, p_deal_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
  v_action text;
  v_car text;
begin
  perform set_config('app.bypass_guard', 'on', true);
  update public.dealers set warning_count = warning_count + 1
  where id = p_dealer_id returning warning_count into v_count;

  if v_count >= 3 then
    v_action := 'suspended';
    update public.dealers set status = 'suspended' where id = p_dealer_id;
  elsif v_count = 2 then
    v_action := 'blocked_7d';
    update public.dealers set bid_blocked_until = now() + interval '7 days' where id = p_dealer_id;
  else
    v_action := 'warning';
  end if;
  perform set_config('app.bypass_guard', 'off', true);

  insert into public.dealer_penalties (dealer_id, deal_id, reason, action) values (p_dealer_id, p_deal_id, p_reason, v_action);

  -- 관리자 경고처럼 거래가 없는 패널티는 차 이름 대신 Satu
  v_car := coalesce(public.car_label((select a.car_id from public.deals d join public.auctions a on a.id = d.auction_id where d.id = p_deal_id)), 'Satu');
  if v_action = 'warning' then
    perform public.notify(p_dealer_id, 'penalty_warning', jsonb_build_object('car', v_car), '/dealer/activity');
  elsif v_action = 'blocked_7d' then
    perform public.notify(p_dealer_id, 'penalty_blocked', jsonb_build_object('car', v_car), '/dealer/activity');
  end if;
  -- 정지는 dealers 상태 변경 트리거가 'dealer_suspended' 알림을 보낸다
end;
$$;

create or replace function public.admin_warn_dealer(p_dealer_id uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  if not exists (select 1 from public.dealers where id = p_dealer_id and status = 'approved') then
    raise exception 'dealer not approved';
  end if;
  perform public.apply_dealer_penalty(p_dealer_id, null, 'admin_warning');
  update public.dealer_penalties set note = nullif(btrim(p_note), '')
  where id = (select id from public.dealer_penalties where dealer_id = p_dealer_id order by created_at desc limit 1);
end;
$$;

create or replace function public.revoke_penalty(p_penalty_id uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_penalty public.dealer_penalties;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  select * into v_penalty from public.dealer_penalties where id = p_penalty_id and revoked_at is null for update;
  if v_penalty.id is null then
    raise exception 'penalty not found';
  end if;

  update public.dealer_penalties
  set revoked_at = now(), revoked_by = auth.uid(), revoke_note = nullif(btrim(p_note), '')
  where id = p_penalty_id;

  update public.dealers
  set warning_count = greatest(warning_count - 1, 0),
      bid_blocked_until = case when v_penalty.action = 'blocked_7d' then null else bid_blocked_until end,
      status = case when v_penalty.action = 'suspended' and status = 'suspended' then 'approved'::public.dealer_status else status end
  where id = v_penalty.dealer_id;

  perform public.notify(v_penalty.dealer_id, 'penalty_revoked', jsonb_build_object('text', coalesce(nullif(btrim(p_note), ''), '')), '/dealer/activity');
end;
$$;

revoke execute on function public.admin_warn_dealer(uuid, text) from public, anon;
revoke execute on function public.revoke_penalty(uuid, text) from public, anon;
grant execute on function public.admin_warn_dealer(uuid, text) to authenticated;
grant execute on function public.revoke_penalty(uuid, text) to authenticated;
