-- Meniul de acasă: Web Push delivery.
--
-- Every new row in public.notifications is announced on the "push" channel;
-- the app server (lib/server/push.ts) renders the text in the recipient's
-- language and sends it to all of their browsers with VAPID.

create or replace function public.notifications_send_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_notify('push', new.id::text);
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
