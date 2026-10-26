-- 시범 운영: 수수료 무료. 관리자 설정 fees_enabled = 'off'이면 거래가 끝나도 수수료 청구서를 만들지 않는다.
-- 유료 전환 시 설정에서 켜면 그 뒤에 완료되는 거래부터 청구한다 (지난 거래는 소급하지 않는다).

insert into public.app_settings (key, value) values ('fees_enabled', 'off')
on conflict (key) do nothing;

create or replace function public.on_deal_completed_invoice()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_fee bigint;
  v_car text;
begin
  if new.status = 'completed' and old.status <> 'completed'
     and coalesce(public.setting('fees_enabled'), 'on') <> 'off' then
    v_fee := public.calc_dealer_fee(coalesce(new.final_price, new.agreed_price));
    v_car := public.car_label((select car_id from public.auctions where id = new.auction_id));
    insert into public.payments (user_id, purpose, amount, deal_id, description, due_at)
    values (new.dealer_id, 'dealer_fee', v_fee, new.id, v_car,
            now() + make_interval(days => coalesce(public.setting('fee_due_days')::int, 7)))
    on conflict do nothing;
    perform public.notify(new.dealer_id, 'fee_invoice', jsonb_build_object('car', v_car, 'amount', v_fee), '/dealer/billing');
  end if;
  return new;
end;
$$;
