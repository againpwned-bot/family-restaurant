create type public.app_role as enum ('owner', 'admin', 'client');

create type public.order_status as enum (
  'received',
  'accepted',
  'cooking',
  'ready',
  'handed_over',
  'rejected',
  'cancelled'
);

create type public.notification_type as enum (
  'order_new',
  'order_cancelled',
  'order_accepted',
  'order_rejected',
  'order_ready',
  'order_extended',
  'test'
);

create or replace function public.today_local()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Bucharest')::date
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  role public.app_role not null default 'client',
  locale text not null default 'ro',
  animation_pref text not null default 'auto',
  animation_detected text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_.-]{3,32}$'),
  constraint profiles_display_name_length check (char_length(btrim(display_name)) between 1 and 60),
  constraint profiles_locale_valid check (locale in ('ro', 'en')),
  constraint profiles_animation_pref_valid check (animation_pref in ('auto', 'full', 'lite', 'reduced')),
  constraint profiles_animation_detected_valid check (
    animation_detected is null or animation_detected in ('full', 'lite', 'reduced')
  )
);

create unique index profiles_username_lower_key on public.profiles (lower(username));

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid())
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role in ('owner', 'admin') from public.profiles p where p.id = (select auth.uid())),
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
    (select p.role = 'owner' from public.profiles p where p.id = (select auth.uid())),
    false
  )
$$;

create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  photo_path text,
  photo_width integer,
  photo_height integer,
  photo_blur text,
  cook_minutes integer not null default 30,
  available_on date,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dishes_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint dishes_description_length check (char_length(description) <= 1000),
  constraint dishes_cook_minutes_range check (cook_minutes between 1 and 600),
  constraint dishes_photo_blur_length check (photo_blur is null or char_length(photo_blur) <= 4000),
  constraint dishes_photo_size_positive check (
    (photo_width is null or photo_width > 0) and (photo_height is null or photo_height > 0)
  )
);

create index dishes_available_on_idx on public.dishes (available_on) where archived_at is null;

create trigger dishes_set_updated_at
  before update on public.dishes
  for each row execute function public.set_updated_at();

create table public.dish_ingredients (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references public.dishes (id) on delete cascade,
  position integer not null default 0,
  name text not null,
  quantity numeric(10, 2),
  unit text not null default '',
  constraint dish_ingredients_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint dish_ingredients_quantity_positive check (quantity is null or quantity > 0),
  constraint dish_ingredients_unit_length check (char_length(unit) <= 20)
);

create index dish_ingredients_dish_idx on public.dish_ingredients (dish_id, position);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity,
  client_id uuid not null references public.profiles (id) on delete cascade,
  dish_id uuid references public.dishes (id) on delete set null,
  dish_name text not null,
  dish_photo_path text,
  quantity integer not null default 1,
  comment text,
  requested_for timestamptz,
  status public.order_status not null default 'received',
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  reject_reason text,
  timer_minutes integer,
  eta_at timestamptz,
  cooking_at timestamptz,
  ready_at timestamptz,
  handed_over_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_quantity_range check (quantity between 1 and 20),
  constraint orders_comment_length check (comment is null or char_length(comment) <= 500),
  constraint orders_reject_reason_length check (reject_reason is null or char_length(reject_reason) <= 300),
  constraint orders_timer_minutes_range check (timer_minutes is null or timer_minutes between 1 and 720)
);

create unique index orders_number_key on public.orders (number);
create index orders_client_created_idx on public.orders (client_id, created_at desc);
create index orders_open_status_idx on public.orders (status, created_at)
  where status in ('received', 'accepted', 'cooking', 'ready');
create index orders_dish_idx on public.orders (dish_id);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint order_events_kind_valid check (
    kind in ('created', 'accepted', 'rejected', 'cooking', 'extended', 'ready', 'handed_over', 'cancelled')
  )
);

create index order_events_order_idx on public.order_events (order_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid references public.orders (id) on delete cascade,
  type public.notification_type not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  failure_count integer not null default 0,
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_length check (char_length(endpoint) <= 2048)
);

create unique index push_subscriptions_endpoint_key on public.push_subscriptions (endpoint);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.shopping_checks (
  day date not null default public.today_local(),
  item_key text not null,
  quantity numeric(12, 2),
  checked_by uuid references public.profiles (id) on delete set null,
  checked_at timestamptz not null default now(),
  primary key (day, item_key),
  constraint shopping_checks_item_key_length check (char_length(item_key) <= 160)
);
