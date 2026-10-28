revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

alter table public.profiles enable row level security;
alter table public.dishes enable row level security;
alter table public.dish_ingredients enable row level security;
alter table public.orders enable row level security;
alter table public.order_events enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.shopping_checks enable row level security;

grant select on public.profiles to authenticated;
grant update (display_name, locale, animation_pref, animation_detected) on public.profiles to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated
  using (true);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

grant select, insert, update, delete on public.dishes to authenticated;
grant select, insert, update, delete on public.dish_ingredients to authenticated;

create policy dishes_select on public.dishes
  for select to authenticated
  using (
    (select public.is_staff())
    or (archived_at is null and available_on = (select public.today_local()))
    or exists (
      select 1 from public.orders o
      where o.dish_id = dishes.id and o.client_id = (select auth.uid())
    )
  );

create policy dishes_insert_staff on public.dishes
  for insert to authenticated
  with check ((select public.is_staff()));

create policy dishes_update_staff on public.dishes
  for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create policy dishes_delete_staff on public.dishes
  for delete to authenticated
  using ((select public.is_staff()));

create policy dish_ingredients_select on public.dish_ingredients
  for select to authenticated
  using (exists (select 1 from public.dishes d where d.id = dish_ingredients.dish_id));

create policy dish_ingredients_insert_staff on public.dish_ingredients
  for insert to authenticated
  with check ((select public.is_staff()));

create policy dish_ingredients_update_staff on public.dish_ingredients
  for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create policy dish_ingredients_delete_staff on public.dish_ingredients
  for delete to authenticated
  using ((select public.is_staff()));

grant select on public.orders to authenticated;
grant select on public.order_events to authenticated;

create policy orders_select on public.orders
  for select to authenticated
  using (client_id = (select auth.uid()) or (select public.is_staff()));

create policy order_events_select on public.order_events
  for select to authenticated
  using (
    (select public.is_staff())
    or exists (
      select 1 from public.orders o
      where o.id = order_events.order_id and o.client_id = (select auth.uid())
    )
  );

grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (recipient_id = (select auth.uid()));

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (recipient_id = (select auth.uid()));

grant select, delete on public.push_subscriptions to authenticated;

create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.shopping_checks to authenticated;

create policy shopping_checks_staff on public.shopping_checks
  for all to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));
