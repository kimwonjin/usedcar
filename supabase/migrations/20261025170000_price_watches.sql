-- 내 차 시세 알림: 시세 조회 후 "매달 알림 받기"를 누르면, 매달 1일 그 차종의 현재 평균 낙찰가를 알림으로 보낸다.
-- 아직 팔 생각이 없는 차주를 다시 데려오는 기능 (헤이딜러 시세 알림).

create table public.price_watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  make text not null check (char_length(btrim(make)) between 1 and 40),
  model text not null check (char_length(btrim(model)) between 1 and 40),
  year int not null check (year between 1960 and 2100),
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, make, model, year)
);

alter table public.price_watches enable row level security;
create policy "price watches: own" on public.price_watches for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 한 사람당 5개까지
create or replace function public.limit_price_watches()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.price_watches where user_id = new.user_id) >= 5 then
    raise exception 'too many watches';
  end if;
  return new;
end;
$$;

create trigger price_watches_limit
  before insert on public.price_watches
  for each row execute function public.limit_price_watches();

-- 매달 1일: 거래 데이터가 있는 차종만 현재 평균가를 알린다 (데이터가 없으면 이번 달은 건너뜀)
create or replace function public.notify_price_watches()
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_watch public.price_watches;
  v_est record;
  v_count int := 0;
begin
  for v_watch in select * from public.price_watches loop
    select * into v_est from public.estimate_price(v_watch.make, v_watch.model, v_watch.year);
    if v_est.sample > 0 and v_est.avg_price is not null then
      perform public.notify(v_watch.user_id, 'price_watch',
        jsonb_build_object('car', v_watch.make || ' ' || v_watch.model || ' ' || v_watch.year, 'amount', v_est.avg_price),
        '/price?make=' || replace(v_watch.make, ' ', '+') || '&model=' || replace(v_watch.model, ' ', '+') || '&year=' || v_watch.year);
      update public.price_watches set last_notified_at = now() where id = v_watch.id;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- 알마티 시간 1일 오전 10시 (UTC 05:00)
select cron.schedule('notify-price-watches', '0 5 1 * *', 'select public.notify_price_watches()');

revoke execute on function public.limit_price_watches() from public, anon, authenticated;
revoke execute on function public.notify_price_watches() from public, anon, authenticated;
