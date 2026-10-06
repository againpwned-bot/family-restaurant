-- Meniul de acasă: order status machine + notifications.
--
--   received -> accepted -> cooking -> ready -> handed_over
--   received | accepted -> rejected            (admin, optional reason)
--   received | accepted -> cancelled           (client, only before cooking)
--
-- Every function raises an exception whose MESSAGE is a stable machine key
-- (e.g. 'dish_unavailable'); the app maps those keys to translated text.

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------

create or replace function public._require_staff()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

create or replace function public._log_order_event(p_order_id uuid, p_kind text, p_data jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.order_events (order_id, actor_id, kind, data)
  values (p_order_id, auth.uid(), p_kind, coalesce(p_data, '{}'::jsonb));
$$;

-- Moves an order from one of `p_from` to `p_to`, or explains why it cannot.
create or replace function public._order_for_transition(p_order_id uuid, p_from public.order_status[])
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if not (v_order.status = any (p_from)) then
    raise exception 'invalid_transition' using errcode = 'P0001',
      detail = format('status is %s', v_order.status);
  end if;
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Client actions
-- ---------------------------------------------------------------------------

create or replace function public.place_order(
  p_dish_id uuid,
  p_quantity integer default 1,
  p_comment text default null,
  p_requested_for timestamptz default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_dish public.dishes;
  v_order public.orders;
  v_open integer;
begin
  v_role := public.current_app_role();
  if v_role is null or v_role not in ('owner', 'client') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_dish from public.dishes where id = p_dish_id and archived_at is null;
  if not found then
    raise exception 'dish_not_found' using errcode = 'P0002';
  end if;
  if v_dish.available_on is distinct from public.today_local() then
    raise exception 'dish_unavailable' using errcode = 'P0001';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 20 then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;
  if p_comment is not null and char_length(p_comment) > 500 then
    raise exception 'comment_too_long' using errcode = '22023';
  end if;
  if p_requested_for is not null
     and (p_requested_for < now() - interval '5 minutes' or p_requested_for > now() + interval '24 hours') then
    raise exception 'invalid_requested_time' using errcode = '22023';
  end if;

  select count(*) into v_open from public.orders
  where client_id = auth.uid() and status in ('received', 'accepted', 'cooking', 'ready');
  if v_open >= 10 then
    raise exception 'too_many_open_orders' using errcode = 'P0001';
  end if;

  insert into public.orders (client_id, dish_id, dish_name, dish_photo_path, quantity, comment, requested_for)
  values (
    auth.uid(),
    v_dish.id,
    v_dish.name,
    v_dish.photo_path,
    p_quantity,
    nullif(btrim(coalesce(p_comment, '')), ''),
    p_requested_for
  )
  returning * into v_order;

  perform public._log_order_event(v_order.id, 'created', jsonb_build_object('quantity', p_quantity));
  return v_order;
end;
$$;

create or replace function public.cancel_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id and client_id = auth.uid() for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  -- Once the pot is on the stove it can no longer be cancelled.
  if v_order.status not in ('received', 'accepted') then
    raise exception 'cannot_cancel' using errcode = 'P0001';
  end if;

  update public.orders
     set status = 'cancelled', cancelled_at = now()
   where id = p_order_id
  returning * into v_order;

  perform public._log_order_event(v_order.id, 'cancelled');
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin actions
-- ---------------------------------------------------------------------------

create or replace function public.accept_order(p_order_id uuid, p_minutes integer)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  perform public._require_staff();
  if p_minutes is null or p_minutes < 1 or p_minutes > 600 then
    raise exception 'invalid_minutes' using errcode = '22023';
  end if;
  perform public._order_for_transition(p_order_id, array['received']::public.order_status[]);

  update public.orders
     set status = 'accepted',
         decided_by = auth.uid(),
         decided_at = now(),
         reject_reason = null,
         timer_minutes = p_minutes,
         eta_at = now() + make_interval(mins => p_minutes)
   where id = p_order_id
  returning * into v_order;

  perform public._log_order_event(v_order.id, 'accepted', jsonb_build_object('minutes', p_minutes));
  return v_order;
end;
$$;

create or replace function public.reject_order(p_order_id uuid, p_reason text default null)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform public._require_staff();
  if v_reason is not null and char_length(v_reason) > 300 then
    raise exception 'reason_too_long' using errcode = '22023';
  end if;
  perform public._order_for_transition(p_order_id, array['received', 'accepted']::public.order_status[]);

  update public.orders
     set status = 'rejected',
         decided_by = auth.uid(),
         decided_at = now(),
         reject_reason = v_reason,
         eta_at = null
   where id = p_order_id
  returning * into v_order;

  perform public._log_order_event(v_order.id, 'rejected', jsonb_build_object('reason', v_reason));
  return v_order;
end;
$$;

create or replace function public.start_cooking(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  perform public._require_staff();
  perform public._order_for_transition(p_order_id, array['accepted']::public.order_status[]);

  update public.orders
     set status = 'cooking', cooking_at = now()
   where id = p_order_id
  returning * into v_order;

  perform public._log_order_event(v_order.id, 'cooking');
  return v_order;
end;
$$;

create or replace function public.extend_order_timer(p_order_id uuid, p_minutes integer)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  perform public._require_staff();
  if p_minutes is null or p_minutes < 1 or p_minutes > 120 then
    raise exception 'invalid_minutes' using errcode = '22023';
  end if;
  perform public._order_for_transition(p_order_id, array['accepted', 'cooking']::public.order_status[]);

  -- If the timer already ran out, extend from now rather than from the past.
  update public.orders
     set eta_at = greatest(coalesce(eta_at, now()), now()) + make_interval(mins => p_minutes),
         timer_minutes = least(coalesce(timer_minutes, 0) + p_minutes, 720)
   where id = p_order_id
  returning * into v_order;

  perform public._log_order_event(v_order.id, 'extended', jsonb_build_object('minutes', p_minutes));
  return v_order;
end;
$$;

create or replace function public.mark_order_ready(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  perform public._require_staff();
  perform public._order_for_transition(p_order_id, array['accepted', 'cooking']::public.order_status[]);

  update public.orders
     set status = 'ready',
         ready_at = now(),
         cooking_at = coalesce(cooking_at, now())
   where id = p_order_id
  returning * into v_order;

  perform public._log_order_event(v_order.id, 'ready');
  return v_order;
end;
$$;

create or replace function public.hand_over_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  perform public._require_staff();
  perform public._order_for_transition(p_order_id, array['ready']::public.order_status[]);

  update public.orders
     set status = 'handed_over', handed_over_at = now()
   where id = p_order_id
  returning * into v_order;

  perform public._log_order_event(v_order.id, 'handed_over');
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notifications: created from order changes, one row per recipient.
-- The person who caused the change is never notified about it.
-- ---------------------------------------------------------------------------

create or replace function public.orders_create_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_payload jsonb;
  v_client_name text;
  v_staff_name text;
begin
  select display_name into v_client_name from public.profiles where id = new.client_id;
  select display_name into v_staff_name from public.profiles where id = coalesce(v_actor, new.decided_by);

  v_payload := jsonb_build_object(
    'orderId', new.id,
    'number', new.number,
    'client', v_client_name,
    'dish', new.dish_name,
    'quantity', new.quantity,
    'by', v_staff_name
  );

  if tg_op = 'INSERT' then
    insert into public.notifications (recipient_id, order_id, type, payload)
    select p.id, new.id, 'order_new', v_payload || jsonb_build_object(
      'comment', new.comment,
      'requestedFor', new.requested_for
    )
    from public.profiles p
    where p.role in ('owner', 'admin') and p.id is distinct from v_actor;
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'cancelled' then
      insert into public.notifications (recipient_id, order_id, type, payload)
      select p.id, new.id, 'order_cancelled', v_payload
      from public.profiles p
      where p.role in ('owner', 'admin') and p.id is distinct from v_actor;
    elsif new.client_id is distinct from v_actor then
      if new.status = 'accepted' then
        insert into public.notifications (recipient_id, order_id, type, payload)
        values (new.client_id, new.id, 'order_accepted',
                v_payload || jsonb_build_object('minutes', new.timer_minutes, 'etaAt', new.eta_at));
      elsif new.status = 'rejected' then
        insert into public.notifications (recipient_id, order_id, type, payload)
        values (new.client_id, new.id, 'order_rejected',
                v_payload || jsonb_build_object('reason', new.reject_reason));
      elsif new.status = 'ready' then
        insert into public.notifications (recipient_id, order_id, type, payload)
        values (new.client_id, new.id, 'order_ready', v_payload);
      end if;
    end if;
  elsif new.eta_at is distinct from old.eta_at
        and old.eta_at is not null
        and new.eta_at > old.eta_at
        and new.client_id is distinct from v_actor then
    insert into public.notifications (recipient_id, order_id, type, payload)
    values (new.client_id, new.id, 'order_extended',
            v_payload || jsonb_build_object(
              'minutes', round(extract(epoch from (new.eta_at - greatest(old.eta_at, now()))) / 60),
              'etaAt', new.eta_at
            ));
  end if;

  return new;
end;
$$;

create trigger orders_notify_insert
  after insert on public.orders
  for each row execute function public.orders_create_notifications();

create trigger orders_notify_update
  after update of status, eta_at on public.orders
  for each row execute function public.orders_create_notifications();

-- ---------------------------------------------------------------------------
-- Web Push subscriptions
-- ---------------------------------------------------------------------------

-- A browser endpoint belongs to whoever is signed in on it right now: if the
-- sister signs in on dad's phone, the endpoint moves to her account.
create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_app_role() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or char_length(p_endpoint) > 2048 then
    raise exception 'invalid_subscription' using errcode = '22023';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        failure_count = 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: nothing for anon, explicit list for authenticated.
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.today_local() to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.place_order(uuid, integer, text, timestamptz) to authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;
grant execute on function public.accept_order(uuid, integer) to authenticated;
grant execute on function public.reject_order(uuid, text) to authenticated;
grant execute on function public.start_cooking(uuid) to authenticated;
grant execute on function public.extend_order_timer(uuid, integer) to authenticated;
grant execute on function public.mark_order_ready(uuid) to authenticated;
grant execute on function public.hand_over_order(uuid) to authenticated;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;
