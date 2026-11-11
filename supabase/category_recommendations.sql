-- CommonPick category recommendations
-- Run once in Supabase > SQL Editor > New query.

create table if not exists public.commonpick_category_recommendations (
  id uuid primary key default gen_random_uuid(),
  category text not null check (char_length(trim(category)) between 2 and 60),
  created_at timestamptz not null default now()
);

alter table public.commonpick_category_recommendations enable row level security;

grant insert on public.commonpick_category_recommendations to anon, authenticated;
grant select on public.commonpick_category_recommendations to authenticated;

drop policy if exists "Anyone can submit category recommendations" on public.commonpick_category_recommendations;
create policy "Anyone can submit category recommendations"
on public.commonpick_category_recommendations for insert to anon, authenticated
with check (char_length(trim(category)) between 2 and 60);

drop policy if exists "Admin can view category recommendations" on public.commonpick_category_recommendations;
create policy "Admin can view category recommendations"
on public.commonpick_category_recommendations for select to authenticated
using (public.commonpick_is_admin());
