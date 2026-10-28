create trigger orders_changes after insert or update or delete on public.orders
  for each row execute function internal.notify_change('id');
create trigger order_events_changes after insert or update or delete on public.order_events
  for each row execute function internal.notify_change('id');
create trigger notifications_changes after insert or update or delete on public.notifications
  for each row execute function internal.notify_change('id');
create trigger dishes_changes after insert or update or delete on public.dishes
  for each row execute function internal.notify_change('id');
create trigger dish_ingredients_changes after insert or update or delete on public.dish_ingredients
  for each row execute function internal.notify_change('id');
create trigger shopping_checks_changes after insert or update or delete on public.shopping_checks
  for each row execute function internal.notify_change('day', 'item_key');
