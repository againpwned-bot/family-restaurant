alter table public.dishes alter column cook_minutes drop not null;
alter table public.dishes alter column cook_minutes drop default;
