-- Profiles: dietary notes, avatar, deactivation.
alter table public.profiles
  add column allergies text not null default '',
  add column diet_tags text[] not null default '{}',
  add column avatar_path text,
  add column disabled_at timestamptz,
  add constraint profiles_allergies_length check (char_length(allergies) <= 300),
  add constraint profiles_diet_tags_valid check (
    diet_tags <@ array['vegetarian', 'vegan', 'gluten_free', 'lactose_free', 'nut_allergy', 'no_pork', 'not_spicy']::text[]
  ),
  add constraint profiles_avatar_path_format check (avatar_path is null or avatar_path ~ '^[A-Za-z0-9_-]+\.(webp|jpg)$');

grant update (allergies, diet_tags) on public.profiles to authenticated;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid()) and p.disabled_at is null
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role in ('owner', 'admin') from public.profiles p
      where p.id = (select auth.uid()) and p.disabled_at is null),
    false
  )
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role = 'owner' from public.profiles p where p.id = (select auth.uid()) and p.disabled_at is null),
    false
  )
$$;

create or replace function public.set_avatar(p_user uuid, p_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  if auth.uid() is null or (p_user is distinct from auth.uid() and not public.is_owner()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select avatar_path into v_old from public.profiles where id = p_user for update;
  if not found then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  update public.profiles set avatar_path = p_path where id = p_user;
  return v_old;
end;
$$;

-- Dishes: tags and the meal they belong to (used for order cut-offs).
alter table public.dishes
  add column tags text[] not null default '{}',
  add column meal text,
  add constraint dishes_tags_valid check (
    tags <@ array['vegetarian', 'vegan', 'spicy', 'soup', 'main', 'side', 'salad', 'dessert', 'gluten_free', 'kids']::text[]
  ),
  add constraint dishes_meal_valid check (meal is null or meal in ('breakfast', 'lunch', 'dinner'));

create or replace function public.set_dish_details(p_id uuid, p_tags text[], p_meal text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._require_staff();
  update public.dishes
     set tags = coalesce((select array_agg(distinct t order by t) from unnest(p_tags) t), '{}'),
         meal = nullif(p_meal, '')
   where id = p_id and archived_at is null;
  if not found then
    raise exception 'dish_not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Kitchen settings (a single row).
create table public.app_settings (
  id boolean primary key default true,
  require_push boolean not null default true,
  cutoff_breakfast time,
  cutoff_lunch time,
  cutoff_dinner time,
  cutoff_all time,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint app_settings_single_row check (id)
);
insert into public.app_settings default values;

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

create or replace function public.save_app_settings(
  p_require_push boolean,
  p_cutoff_breakfast time,
  p_cutoff_lunch time,
  p_cutoff_dinner time,
  p_cutoff_all time
)
returns public.app_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.app_settings;
begin
  perform public._require_staff();
  update public.app_settings
     set require_push = coalesce(p_require_push, true),
         cutoff_breakfast = p_cutoff_breakfast,
         cutoff_lunch = p_cutoff_lunch,
         cutoff_dinner = p_cutoff_dinner,
         cutoff_all = p_cutoff_all,
         updated_by = auth.uid()
   where id
  returning * into v;
  return v;
end;
$$;

create or replace function public.order_cutoff(p_meal text)
returns time
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(least(
    coalesce(case p_meal
      when 'breakfast' then s.cutoff_breakfast
      when 'lunch' then s.cutoff_lunch
      when 'dinner' then s.cutoff_dinner
    end, time '23:59:59.999'),
    coalesce(s.cutoff_all, time '23:59:59.999')
  ), time '23:59:59.999')
  from public.app_settings s
$$;

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
  v_cutoff time;
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

  v_cutoff := public.order_cutoff(v_dish.meal);
  if v_cutoff is not null and (now() at time zone 'Europe/Bucharest')::time > v_cutoff then
    raise exception 'ordering_closed' using errcode = 'P0001';
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

-- Menu planner: one row per dish per day. Today's row mirrors dishes.available_on.
create table public.menu_plan (
  day date not null,
  dish_id uuid not null references public.dishes (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (day, dish_id)
);
create index menu_plan_dish_idx on public.menu_plan (dish_id);

insert into public.menu_plan (day, dish_id)
select available_on, id from public.dishes where available_on is not null and archived_at is null
on conflict do nothing;

create or replace function internal.dishes_mirror_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.available_on is not null and new.archived_at is null
     and (tg_op = 'INSERT' or new.available_on is distinct from old.available_on) then
    insert into public.menu_plan (day, dish_id, created_by)
    values (new.available_on, new.id, auth.uid())
    on conflict do nothing;
  end if;
  if tg_op = 'UPDATE' and old.available_on is not null
     and old.available_on is distinct from new.available_on
     and old.available_on >= public.today_local() then
    delete from public.menu_plan where day = old.available_on and dish_id = new.id;
  end if;
  if tg_op = 'UPDATE' and new.archived_at is not null and old.archived_at is null then
    delete from public.menu_plan where dish_id = new.id and day >= public.today_local();
  end if;
  return null;
end;
$$;

create trigger dishes_mirror_plan
  after insert or update of available_on, archived_at on public.dishes
  for each row execute function internal.dishes_mirror_plan();

-- Called once per kitchen day: puts the dishes planned for today on today's menu.
create or replace function internal.apply_menu_plan()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.dishes d
     set available_on = public.today_local()
   where d.archived_at is null
     and d.available_on is distinct from public.today_local()
     and exists (select 1 from public.menu_plan p where p.dish_id = d.id and p.day = public.today_local());
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.set_menu_plan(p_day date, p_dish_id uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._require_staff();
  if p_day is null or p_day < public.today_local() or p_day > public.today_local() + 90 then
    raise exception 'invalid_day' using errcode = '22023';
  end if;
  if not exists (select 1 from public.dishes where id = p_dish_id and archived_at is null) then
    raise exception 'dish_not_found' using errcode = 'P0002';
  end if;
  if p_day = public.today_local() then
    perform public.set_dish_available_today(p_dish_id, p_on);
  elsif p_on then
    insert into public.menu_plan (day, dish_id, created_by) values (p_day, p_dish_id, auth.uid())
    on conflict do nothing;
  else
    delete from public.menu_plan where day = p_day and dish_id = p_dish_id;
  end if;
end;
$$;

create or replace function public._put_on_menu(p_day date, p_dish_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_day = public.today_local() then
    update public.dishes set available_on = p_day
     where id = any (p_dish_ids) and archived_at is null and available_on is distinct from p_day;
  else
    insert into public.menu_plan (day, dish_id, created_by)
    select p_day, d.id, auth.uid() from public.dishes d where d.id = any (p_dish_ids) and d.archived_at is null
    on conflict do nothing;
  end if;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.copy_menu_days(p_from date, p_to date, p_days integer default 7)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer := 0;
  v_offset integer;
  v_target date;
begin
  perform public._require_staff();
  if p_days is null or p_days < 1 or p_days > 14 or p_from is null or p_to is null then
    raise exception 'invalid_day' using errcode = '22023';
  end if;
  for v_offset in 0 .. p_days - 1 loop
    v_target := p_to + v_offset;
    if v_target < public.today_local() or v_target > public.today_local() + 90 then
      continue;
    end if;
    v_total := v_total + public._put_on_menu(
      v_target,
      array(select dish_id from public.menu_plan where day = p_from + v_offset)
    );
  end loop;
  return v_total;
end;
$$;

create or replace function public.clear_menu_day(p_day date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform public._require_staff();
  if p_day is null or p_day < public.today_local() then
    raise exception 'invalid_day' using errcode = '22023';
  end if;
  if p_day = public.today_local() then
    return public.clear_today_menu();
  end if;
  delete from public.menu_plan where day = p_day;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create table public.menu_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dish_ids uuid[] not null default '{}',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint menu_templates_name_length check (char_length(btrim(name)) between 1 and 60)
);

create or replace function public.save_menu_template(p_name text, p_day date)
returns public.menu_templates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.menu_templates;
  v_ids uuid[];
begin
  perform public._require_staff();
  select coalesce(array_agg(p.dish_id), '{}') into v_ids
    from public.menu_plan p join public.dishes d on d.id = p.dish_id
   where p.day = p_day and d.archived_at is null;
  if cardinality(v_ids) = 0 then
    raise exception 'menu_empty' using errcode = 'P0001';
  end if;
  insert into public.menu_templates (name, dish_ids, created_by)
  values (btrim(p_name), v_ids, auth.uid())
  returning * into v;
  return v;
end;
$$;

create or replace function public.apply_menu_template(p_id uuid, p_day date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  perform public._require_staff();
  if p_day is null or p_day < public.today_local() or p_day > public.today_local() + 90 then
    raise exception 'invalid_day' using errcode = '22023';
  end if;
  select dish_ids into v_ids from public.menu_templates where id = p_id;
  if not found then
    raise exception 'template_not_found' using errcode = 'P0002';
  end if;
  return public._put_on_menu(p_day, v_ids);
end;
$$;

create or replace function public.delete_menu_template(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._require_staff();
  delete from public.menu_templates where id = p_id;
end;
$$;

-- Announcements sent by the kitchen.
create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  audience text not null,
  recipient_count integer not null default 0,
  sent_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint broadcasts_title_length check (char_length(btrim(title)) between 1 and 80),
  constraint broadcasts_body_length check (char_length(body) <= 300),
  constraint broadcasts_audience_valid check (audience in ('everyone', 'clients', 'staff', 'people'))
);
create index broadcasts_created_idx on public.broadcasts (created_at desc);

create or replace function public.send_broadcast(p_title text, p_body text, p_audience text, p_people uuid[] default null)
returns public.broadcasts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.broadcasts;
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_sender text;
  v_count integer;
begin
  perform public._require_staff();
  if char_length(v_title) not between 1 and 80 or char_length(v_body) > 300 then
    raise exception 'invalid_broadcast' using errcode = '22023';
  end if;
  if p_audience is null or p_audience not in ('everyone', 'clients', 'staff', 'people') then
    raise exception 'invalid_broadcast' using errcode = '22023';
  end if;
  select display_name into v_sender from public.profiles where id = auth.uid();

  insert into public.broadcasts (title, body, audience, sent_by)
  values (v_title, v_body, p_audience, auth.uid())
  returning * into v;

  insert into public.notifications (recipient_id, type, payload)
  select p.id, 'broadcast', jsonb_build_object('title', v_title, 'body', v_body, 'by', v_sender, 'broadcastId', v.id)
    from public.profiles p
   where p.disabled_at is null
     and p.id is distinct from auth.uid()
     and case p_audience
       when 'everyone' then true
       when 'clients' then p.role in ('owner', 'client')
       when 'staff' then p.role in ('owner', 'admin')
       else p.id = any (coalesce(p_people, '{}'))
     end;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'no_recipients' using errcode = 'P0001';
  end if;

  update public.broadcasts set recipient_count = v_count where id = v.id returning * into v;
  return v;
end;
$$;

-- Chat: 'all' is the family group, 'dm:<uuid>:<uuid>' (ids sorted) is a private conversation.
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation text not null,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint chat_messages_body_length check (char_length(btrim(body)) between 1 and 2000),
  constraint chat_messages_conversation_format check (
    conversation = 'all' or conversation ~ '^dm:[0-9a-f-]{36}:[0-9a-f-]{36}$'
  )
);
create index chat_messages_conversation_idx on public.chat_messages (conversation, created_at desc);

create table public.chat_reads (
  user_id uuid not null references public.profiles (id) on delete cascade,
  conversation text not null,
  last_read_at timestamptz not null default now(),
  primary key (user_id, conversation)
);

create or replace function public.chat_member(p_conversation text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_app_role() is not null and (
    p_conversation = 'all'
    or (p_conversation like 'dm:%' and (select auth.uid())::text = any (string_to_array(substr(p_conversation, 4), ':')))
  )
$$;

create or replace function public.dm_conversation(p_a uuid, p_b uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'dm:' || least(p_a::text, p_b::text) || ':' || greatest(p_a::text, p_b::text)
$$;

create or replace function public.send_chat_message(p_to uuid, p_body text)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.chat_messages;
  v_body text := btrim(coalesce(p_body, ''));
  v_conversation text;
  v_sender text;
begin
  if public.current_app_role() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(v_body) not between 1 and 2000 then
    raise exception 'invalid_message' using errcode = '22023';
  end if;
  if p_to is null then
    v_conversation := 'all';
  else
    if p_to = auth.uid() or not exists (select 1 from public.profiles where id = p_to and disabled_at is null) then
      raise exception 'user_not_found' using errcode = 'P0002';
    end if;
    v_conversation := public.dm_conversation(auth.uid(), p_to);
  end if;

  insert into public.chat_messages (conversation, sender_id, body)
  values (v_conversation, auth.uid(), v_body)
  returning * into v;

  insert into public.chat_reads (user_id, conversation, last_read_at)
  values (auth.uid(), v_conversation, v.created_at)
  on conflict (user_id, conversation) do update set last_read_at = excluded.last_read_at;

  select display_name into v_sender from public.profiles where id = auth.uid();
  insert into public.notifications (recipient_id, type, payload)
  select p.id, 'chat_message', jsonb_build_object(
    'conversation', v_conversation,
    'fromId', auth.uid(),
    'from', v_sender,
    'preview', left(v_body, 140),
    'group', p_to is null
  )
    from public.profiles p
   where p.disabled_at is null
     and p.id <> auth.uid()
     and (p_to is null or p.id = p_to);

  return v;
end;
$$;

create or replace function public.mark_chat_read(p_conversation text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.chat_member(p_conversation) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.chat_reads (user_id, conversation, last_read_at)
  values (auth.uid(), p_conversation, now())
  on conflict (user_id, conversation) do update set last_read_at = excluded.last_read_at;
  update public.notifications set read_at = now()
   where recipient_id = auth.uid() and type = 'chat_message' and read_at is null
     and payload ->> 'conversation' = p_conversation;
end;
$$;

-- Audit log: who changed which dish, user, menu or setting. Order actions come from order_events.
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  label text,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);

create or replace function internal.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changes jsonb := '{}'::jsonb;
  v_key text;
  v_ignore text[] := array[
    'id', 'updated_at', 'created_at', 'updated_by', 'created_by', 'animation_pref', 'animation_detected', 'locale',
    'photo_blur', 'photo_width', 'photo_height'
  ];
begin
  if tg_op = 'UPDATE' then
    for v_key in select jsonb_object_keys(v_new) loop
      continue when v_key = any (v_ignore);
      if v_old -> v_key is distinct from v_new -> v_key then
        v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_object('from', v_old -> v_key, 'to', v_new -> v_key));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then
      return null;
    end if;
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, label, changes)
  values (
    (select p.id from public.profiles p where p.id = auth.uid()),
    lower(tg_op),
    tg_argv[0],
    v_row ->> 'id',
    case when tg_argv[1] is not null then v_row ->> tg_argv[1] end,
    v_changes
  );
  return null;
end;
$$;

create trigger dishes_audit after insert or update or delete on public.dishes
  for each row execute function internal.audit_row('dish', 'name');
create trigger profiles_audit after insert or update or delete on public.profiles
  for each row execute function internal.audit_row('user', 'display_name');
create trigger menu_templates_audit after insert or update or delete on public.menu_templates
  for each row execute function internal.audit_row('template', 'name');
create trigger app_settings_audit after update on public.app_settings
  for each row execute function internal.audit_row('settings', null);
create trigger broadcasts_audit after insert on public.broadcasts
  for each row execute function internal.audit_row('broadcast', 'title');

-- Live updates for the new tables.
create trigger menu_plan_changes after insert or update or delete on public.menu_plan
  for each row execute function internal.notify_change('day', 'dish_id');
create trigger chat_messages_changes after insert or update or delete on public.chat_messages
  for each row execute function internal.notify_change('id');
create trigger app_settings_changes after update on public.app_settings
  for each row execute function internal.notify_change('id');

-- Row-level security.
alter table public.app_settings enable row level security;
alter table public.menu_plan enable row level security;
alter table public.menu_templates enable row level security;
alter table public.broadcasts enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reads enable row level security;
alter table public.audit_log enable row level security;

grant select on public.app_settings, public.menu_plan, public.menu_templates, public.broadcasts,
  public.chat_messages, public.chat_reads, public.audit_log to authenticated;

create policy app_settings_select on public.app_settings for select to authenticated using (true);
create policy menu_plan_select on public.menu_plan for select to authenticated using ((select public.is_staff()));
create policy menu_templates_select on public.menu_templates for select to authenticated using ((select public.is_staff()));
create policy broadcasts_select on public.broadcasts for select to authenticated using ((select public.is_staff()));
create policy chat_messages_select on public.chat_messages for select to authenticated
  using (public.chat_member(conversation));
create policy chat_reads_select_own on public.chat_reads for select to authenticated
  using (user_id = (select auth.uid()));
create policy audit_log_select on public.audit_log for select to authenticated using ((select public.is_owner()));

revoke execute on function public.set_avatar(uuid, text) from public, anon;
revoke execute on function public.set_dish_details(uuid, text[], text) from public, anon;
revoke execute on function public.save_app_settings(boolean, time, time, time, time) from public, anon;
revoke execute on function public.order_cutoff(text) from public, anon;
revoke execute on function public.set_menu_plan(date, uuid, boolean) from public, anon;
revoke execute on function public._put_on_menu(date, uuid[]) from public, anon, authenticated;
revoke execute on function public.copy_menu_days(date, date, integer) from public, anon;
revoke execute on function public.clear_menu_day(date) from public, anon;
revoke execute on function public.save_menu_template(text, date) from public, anon;
revoke execute on function public.apply_menu_template(uuid, date) from public, anon;
revoke execute on function public.delete_menu_template(uuid) from public, anon;
revoke execute on function public.send_broadcast(text, text, text, uuid[]) from public, anon;
revoke execute on function public.chat_member(text) from public, anon;
revoke execute on function public.dm_conversation(uuid, uuid) from public, anon;
revoke execute on function public.send_chat_message(uuid, text) from public, anon;
revoke execute on function public.mark_chat_read(text) from public, anon;
revoke execute on function internal.apply_menu_plan() from public;

grant execute on function public.set_avatar(uuid, text) to authenticated;
grant execute on function public.set_dish_details(uuid, text[], text) to authenticated;
grant execute on function public.save_app_settings(boolean, time, time, time, time) to authenticated;
grant execute on function public.order_cutoff(text) to authenticated;
grant execute on function public.set_menu_plan(date, uuid, boolean) to authenticated;
grant execute on function public.copy_menu_days(date, date, integer) to authenticated;
grant execute on function public.clear_menu_day(date) to authenticated;
grant execute on function public.save_menu_template(text, date) to authenticated;
grant execute on function public.apply_menu_template(uuid, date) to authenticated;
grant execute on function public.delete_menu_template(uuid) to authenticated;
grant execute on function public.send_broadcast(text, text, text, uuid[]) to authenticated;
grant execute on function public.chat_member(text) to authenticated;
grant execute on function public.dm_conversation(uuid, uuid) to authenticated;
grant execute on function public.send_chat_message(uuid, text) to authenticated;
grant execute on function public.mark_chat_read(text) to authenticated;
