-- Meniul de acasă: photo storage + realtime.

-- ---------------------------------------------------------------------------
-- Storage: public-read bucket for dish photos, writable by staff only.
-- Photos are resized to <= 1600px WebP in the browser before upload; the 2 MB
-- limit here is only a safety net.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dish-photos',
  'dish-photos',
  true,
  2097152,
  array['image/webp', 'image/jpeg', 'image/png', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "dish_photos_staff_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'dish-photos' and (select public.is_staff()));

create policy "dish_photos_staff_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dish-photos' and (select public.is_staff()));

create policy "dish_photos_staff_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'dish-photos' and (select public.is_staff()))
  with check (bucket_id = 'dish-photos' and (select public.is_staff()));

create policy "dish_photos_staff_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'dish-photos' and (select public.is_staff()));

-- ---------------------------------------------------------------------------
-- Realtime: postgres_changes respects the RLS policies above, so every
-- subscriber only receives rows they are allowed to read.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table
  public.orders,
  public.order_events,
  public.notifications,
  public.dishes,
  public.dish_ingredients,
  public.shopping_checks;

-- Note: with RLS on, DELETE events only carry the primary key; the app
-- handles deletes by id.
