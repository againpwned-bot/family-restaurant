-- Meniul de acasă: admin helpers (dishes, today's menu, shopping list).
-- All of them are staff-only and use the kitchen's local date (today_local()).

-- ---------------------------------------------------------------------------
-- Dishes: create / update a dish and replace its ingredients atomically.
-- p_ingredients: [{ "name": "Orez", "quantity": 20, "unit": "g" }, ...]
-- ---------------------------------------------------------------------------

create or replace function public.save_dish(
  p_id uuid,
  p_name text,
  p_description text,
  p_cook_minutes integer,
  p_available_today boolean,
  p_photo_path text,
  p_photo_width integer,
  p_photo_height integer,
  p_photo_blur text,
  p_ingredients jsonb
)
returns public.dishes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dish public.dishes;
  v_item jsonb;
  v_position integer := 0;
begin
  perform public._require_staff();

  if p_ingredients is null or jsonb_typeof(p_ingredients) <> 'array' then
    raise exception 'invalid_ingredients' using errcode = '22023';
  end if;
  if jsonb_array_length(p_ingredients) > 60 then
    raise exception 'too_many_ingredients' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.dishes (
      name, description, cook_minutes, available_on,
      photo_path, photo_width, photo_height, photo_blur, created_by
    )
    values (
      btrim(p_name), coalesce(btrim(p_description), ''), p_cook_minutes,
      case when p_available_today then public.today_local() end,
      p_photo_path, p_photo_width, p_photo_height, p_photo_blur, auth.uid()
    )
    returning * into v_dish;
  else
    update public.dishes
       set name = btrim(p_name),
           description = coalesce(btrim(p_description), ''),
           cook_minutes = p_cook_minutes,
           available_on = case
             when p_available_today then public.today_local()
             when available_on = public.today_local() then null
             else available_on
           end,
           photo_path = p_photo_path,
           photo_width = p_photo_width,
           photo_height = p_photo_height,
           photo_blur = p_photo_blur
     where id = p_id and archived_at is null
    returning * into v_dish;
    if not found then
      raise exception 'dish_not_found' using errcode = 'P0002';
    end if;
    delete from public.dish_ingredients where dish_id = p_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_ingredients) loop
    insert into public.dish_ingredients (dish_id, position, name, quantity, unit)
    values (
      v_dish.id,
      v_position,
      btrim(v_item ->> 'name'),
      nullif(v_item ->> 'quantity', '')::numeric,
      coalesce(btrim(v_item ->> 'unit'), '')
    );
    v_position := v_position + 1;
  end loop;

  return v_dish;
end;
$$;

-- Dishes that were ever ordered are archived (history keeps their name and
-- photo); the others are deleted. Returns the photo path the caller may remove.
create or replace function public.delete_dish(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dish public.dishes;
begin
  perform public._require_staff();
  select * into v_dish from public.dishes where id = p_id;
  if not found then
    raise exception 'dish_not_found' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.orders where dish_id = p_id) then
    update public.dishes set archived_at = now(), available_on = null where id = p_id;
    return jsonb_build_object('mode', 'archived', 'photo_path', null);
  end if;

  delete from public.dishes where id = p_id;
  return jsonb_build_object('mode', 'deleted', 'photo_path', v_dish.photo_path);
end;
$$;

-- ---------------------------------------------------------------------------
-- Today's menu
-- ---------------------------------------------------------------------------

create or replace function public.set_dish_available_today(p_dish_id uuid, p_available boolean)
returns public.dishes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dish public.dishes;
begin
  perform public._require_staff();
  update public.dishes
     set available_on = case
       when p_available then public.today_local()
       when available_on = public.today_local() then null
       else available_on
     end
   where id = p_dish_id and archived_at is null
  returning * into v_dish;
  if not found then
    raise exception 'dish_not_found' using errcode = 'P0002';
  end if;
  return v_dish;
end;
$$;

-- Puts yesterday's dishes back on today's menu. Returns how many were added.
create or replace function public.copy_yesterday_menu()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform public._require_staff();
  update public.dishes
     set available_on = public.today_local()
   where archived_at is null and available_on = public.today_local() - 1;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.clear_today_menu()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform public._require_staff();
  update public.dishes set available_on = null where available_on = public.today_local();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Shopping list ticks
-- ---------------------------------------------------------------------------

create or replace function public.set_shopping_check(p_item_key text, p_checked boolean, p_quantity numeric default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._require_staff();
  if p_item_key is null or char_length(p_item_key) = 0 or char_length(p_item_key) > 160 then
    raise exception 'invalid_item' using errcode = '22023';
  end if;
  if p_checked then
    insert into public.shopping_checks (day, item_key, quantity, checked_by)
    values (public.today_local(), p_item_key, p_quantity, auth.uid())
    on conflict (day, item_key) do update
      set quantity = excluded.quantity, checked_by = excluded.checked_by, checked_at = now();
  else
    delete from public.shopping_checks where day = public.today_local() and item_key = p_item_key;
  end if;
end;
$$;

create or replace function public.reset_shopping_checks()
returns void
language sql
security definer
set search_path = ''
as $$
  select public._require_staff();
  delete from public.shopping_checks where day = public.today_local();
$$;

revoke execute on function public.save_dish(uuid, text, text, integer, boolean, text, integer, integer, text, jsonb) from public, anon;
revoke execute on function public.delete_dish(uuid) from public, anon;
revoke execute on function public.set_dish_available_today(uuid, boolean) from public, anon;
revoke execute on function public.copy_yesterday_menu() from public, anon;
revoke execute on function public.clear_today_menu() from public, anon;
revoke execute on function public.set_shopping_check(text, boolean, numeric) from public, anon;
revoke execute on function public.reset_shopping_checks() from public, anon;

grant execute on function public.save_dish(uuid, text, text, integer, boolean, text, integer, integer, text, jsonb) to authenticated;
grant execute on function public.delete_dish(uuid) to authenticated;
grant execute on function public.set_dish_available_today(uuid, boolean) to authenticated;
grant execute on function public.copy_yesterday_menu() to authenticated;
grant execute on function public.clear_today_menu() to authenticated;
grant execute on function public.set_shopping_check(text, boolean, numeric) to authenticated;
grant execute on function public.reset_shopping_checks() to authenticated;
