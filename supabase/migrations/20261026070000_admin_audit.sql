-- 관리자 작업 기록: 관리자가 바꾼 내용(누가·언제·무엇을·어떻게)을 자동으로 남긴다.
-- 검수 승인·반려, 딜러 승인·정지, 패널티, 감가 심사, 결제·보상, 경매·거래 취소, 설정·공지 변경 등.
-- 기록은 관리자만 읽고, 아무도 고치거나 지울 수 없다.

create table public.admin_audit (
  id bigserial primary key,
  admin_id uuid references public.profiles (id) on delete set null,
  op text not null check (op in ('INSERT', 'UPDATE', 'DELETE')),
  target_table text not null,
  target_id text,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.admin_audit (created_at desc);
create index on public.admin_audit (target_table, target_id);

alter table public.admin_audit enable row level security;
create policy "admin audit: admin read" on public.admin_audit for select using (public.is_admin());

-- 바뀐 칸만 {칸: [이전,이후]}로 남긴다. 긴 값은 줄이고, 자주 바뀌는 시각 칸은 뺀다
create or replace function public.audit_admin_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else '{}'::jsonb end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else '{}'::jsonb end;
  v_changes jsonb := '{}'::jsonb;
  v_key text;
  v_short jsonb;
begin
  -- 시스템 작업(예약 작업 등)이나 일반 사용자의 변경은 기록하지 않는다
  if auth.uid() is null or not public.is_admin() then
    return null;
  end if;
  for v_key in select jsonb_object_keys(v_old || v_new) loop
    continue when v_key in ('updated_at', 'created_at');
    if v_old -> v_key is distinct from v_new -> v_key then
      v_short := jsonb_build_array(
        case when length((v_old -> v_key)::text) > 200 then to_jsonb(left((v_old -> v_key)::text, 200) || '…') else v_old -> v_key end,
        case when length((v_new -> v_key)::text) > 200 then to_jsonb(left((v_new -> v_key)::text, 200) || '…') else v_new -> v_key end);
      v_changes := v_changes || jsonb_build_object(v_key, v_short);
    end if;
  end loop;
  if v_changes = '{}'::jsonb then
    return null;
  end if;
  insert into public.admin_audit (admin_id, op, target_table, target_id, changes)
  values (auth.uid(), tg_op, tg_table_name,
          coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'key', v_old ->> 'key', v_new ->> 'deal_id', v_old ->> 'deal_id'),
          v_changes);
  return null;
end;
$$;

revoke execute on function public.audit_admin_change() from public, anon, authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'dealers', 'cars', 'auctions', 'deals', 'depreciation_claims', 'dealer_penalties', 'payments',
    'referral_rewards', 'app_settings', 'fee_bands', 'announcements', 'reports', 'profiles', 'deal_inspections'
  ] loop
    execute format(
      'create trigger zz_admin_audit after insert or update or delete on public.%I for each row execute function public.audit_admin_change()',
      v_table);
  end loop;
end;
$$;
