-- Meniul de acasă: Web Push delivery.
--
-- Every new row in public.notifications is POSTed (pg_net) to the send-push
-- Edge Function, which renders the text in the recipient's language and sends
-- it to all of their browsers with VAPID. Needs two Vault secrets:
--
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<long random string>', 'push_webhook_secret');
--
-- (the same random string goes into the function's PUSH_WEBHOOK_SECRET). Until
-- they exist the trigger does nothing and the app relies on in-app banners.

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'net') then
    create extension if not exists pg_net;
  end if;
end;
$$;

alter type public.notification_type add value if not exists 'test';

create or replace function public.notifications_send_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url' limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_webhook_secret' limit 1;
  if v_url is null or v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/send-push',
    body := jsonb_build_object('record', to_jsonb(new)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  -- A push problem must never block placing or updating an order.
  raise warning 'send-push webhook failed: %', sqlerrm;
  return new;
end;
$$;

create trigger notifications_send_push
  after insert on public.notifications
  for each row execute function public.notifications_send_push();

-- "Send a test notification" from Settings (to yourself only).
create or replace function public.send_test_notification()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_app_role() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.notifications where recipient_id = auth.uid() and type = 'test';
  insert into public.notifications (recipient_id, type, payload)
  values (auth.uid(), 'test', '{}'::jsonb);
end;
$$;

revoke execute on function public.notifications_send_push() from public, anon, authenticated;
revoke execute on function public.send_test_notification() from public, anon;
grant execute on function public.send_test_notification() to authenticated;
