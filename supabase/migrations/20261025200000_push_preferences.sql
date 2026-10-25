-- 푸시 알림 설정: 종류별 끄기(경매 활동·채팅·시세) + 밤 10시~아침 8시(알마티) 푸시 끄기.
-- 앱 안 알림함에는 그대로 쌓이고, 휴대폰 푸시만 보내지 않는다.
-- 거래·결제·제재·심사 등 중요한 알림은 끌 수 없다.

alter table public.profiles
  add column push_muted text[] not null default '{}'
    check (push_muted <@ array['auction', 'chat', 'price']::text[]),
  add column push_quiet_night boolean not null default false;

create or replace function public.push_category(p_type text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_type in ('new_auction', 'ending_soon', 'outbid', 'first_bid', 'car_updated', 'question_asked', 'question_answered') then 'auction'
    when p_type = 'new_message' then 'chat'
    when p_type = 'price_watch' then 'price'
    else 'important'
  end;
$$;

create or replace function public.push_allowed(p_user uuid, p_type text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select not (public.push_category(p_type) = any(p.push_muted))
       and not (p.push_quiet_night and public.push_category(p_type) <> 'important'
                and extract(hour from now() at time zone 'Asia/Almaty') not between 8 and 21)
    from public.profiles p where p.id = p_user
  ), true);
$$;

create or replace function public.dispatch_push(p_user uuid, p_type text, p_params jsonb, p_url text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_endpoint text;
  v_secret text;
  v_subs jsonb;
  v_locale text;
begin
  if not public.push_allowed(p_user, p_type) then
    return;
  end if;

  select value into v_endpoint from public.app_config where key = 'push_dispatch_url';
  select value into v_secret from public.app_config where key = 'push_dispatch_secret';
  if v_endpoint is null or v_secret is null then
    return;
  end if;

  select jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth))
  into v_subs from public.push_subscriptions where user_id = p_user;
  if v_subs is null then
    return;
  end if;

  select locale into v_locale from public.profiles where id = p_user;

  begin
    perform net.http_post(
      url := v_endpoint,
      body := jsonb_build_object(
        'locale', coalesce(v_locale, 'ko'), 'type', p_type, 'params', p_params,
        'url', p_url, 'subscriptions', v_subs),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret)
    );
  exception when others then
    null;
  end;
end;
$$;

revoke execute on function public.dispatch_push(uuid, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.push_allowed(uuid, text) from public, anon, authenticated;
