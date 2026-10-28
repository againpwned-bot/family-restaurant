do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant anon, authenticated to current_user;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  password_hash text not null,
  password_changed_at timestamptz not null default now(),
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists sessions_user_idx on auth.sessions (user_id);

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

revoke all on schema auth from public;
grant usage on schema auth to authenticated;
revoke all on all tables in schema auth from public, authenticated;
grant execute on function auth.uid() to authenticated;

create schema if not exists internal;
revoke all on schema internal from public;

create table if not exists internal.migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

create or replace function internal.notify_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_pk jsonb := '{}'::jsonb;
  v_col text;
begin
  foreach v_col in array tg_argv loop
    v_pk := v_pk || jsonb_build_object(v_col, v_row -> v_col);
  end loop;
  perform pg_notify('changes', jsonb_build_object('table', tg_table_name, 'type', tg_op, 'pk', v_pk)::text);
  return null;
end;
$$;

grant usage on schema public to authenticated;
