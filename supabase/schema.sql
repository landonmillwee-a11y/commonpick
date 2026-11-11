-- CommonPick multi-poll schema
-- Run this entire file in Supabase > SQL Editor > New query.
-- Safe to run on the existing MVP: preserves existing vote rows.

create table if not exists public.commonpick_polls (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null default 'COMMUNITY',
  status text not null default 'draft' check (status in ('draft','published','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commonpick_options (
  poll_id uuid not null references public.commonpick_polls(id) on delete cascade,
  option_id text not null,
  label text not null,
  position integer not null default 0,
  primary key (poll_id, option_id)
);

-- The original MVP constrained option_id to four hardcoded fries choices.
alter table public.commonpick_votes
  drop constraint if exists commonpick_votes_option_id_check;

alter table public.commonpick_votes enable row level security;
alter table public.commonpick_polls enable row level security;
alter table public.commonpick_options enable row level security;

-- Admin identity is restricted to the single email supplied by the owner.
create or replace function public.commonpick_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'email' = 'landonmillwee@gmail.com', false);
$$;


-- Public category suggestions: visitors can submit, only the admin can read.
create table if not exists public.commonpick_category_recommendations (
  id uuid primary key default gen_random_uuid(),
  category text not null check (
    char_length(btrim(category)) between 2 and 60
    and category = btrim(category)
  ),
  created_at timestamptz not null default now()
);

alter table public.commonpick_category_recommendations enable row level security;
revoke all on public.commonpick_category_recommendations from anon, authenticated;
grant insert on public.commonpick_category_recommendations to anon, authenticated;
grant select on public.commonpick_category_recommendations to authenticated;

drop policy if exists "Visitors can submit category recommendations" on public.commonpick_category_recommendations;
create policy "Visitors can submit category recommendations"
on public.commonpick_category_recommendations for insert to anon, authenticated
with check (
  char_length(btrim(category)) between 2 and 60
  and category = btrim(category)
);

drop policy if exists "Admin can read category recommendations" on public.commonpick_category_recommendations;
create policy "Admin can read category recommendations"
on public.commonpick_category_recommendations for select to authenticated
using (public.commonpick_is_admin());

-- Validate public votes against a published poll and one of its options.
create or replace function public.commonpick_vote_is_valid(p_poll_id uuid, p_option_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.commonpick_polls p
    join public.commonpick_options o on o.poll_id = p.id
    where p.id = p_poll_id
      and p.status = 'published'
      and o.option_id = p_option_id
  );
$$;

grant execute on function public.commonpick_is_admin() to anon, authenticated;
grant execute on function public.commonpick_vote_is_valid(uuid, text) to anon, authenticated;

-- Polls: anyone can read published polls; only the admin can see/manage drafts.
drop policy if exists "Public can view published polls" on public.commonpick_polls;
create policy "Public can view published polls"
on public.commonpick_polls for select to anon, authenticated
using (status = 'published');

drop policy if exists "Admin can view all polls" on public.commonpick_polls;
create policy "Admin can view all polls"
on public.commonpick_polls for select to authenticated
using (public.commonpick_is_admin());

drop policy if exists "Admin can create polls" on public.commonpick_polls;
create policy "Admin can create polls"
on public.commonpick_polls for insert to authenticated
with check (public.commonpick_is_admin());

drop policy if exists "Admin can update polls" on public.commonpick_polls;
create policy "Admin can update polls"
on public.commonpick_polls for update to authenticated
using (public.commonpick_is_admin())
with check (public.commonpick_is_admin());

drop policy if exists "Admin can delete polls" on public.commonpick_polls;
create policy "Admin can delete polls"
on public.commonpick_polls for delete to authenticated
using (public.commonpick_is_admin());

-- Options: public can read options belonging to published polls.
drop policy if exists "Public can view published options" on public.commonpick_options;
create policy "Public can view published options"
on public.commonpick_options for select to anon, authenticated
using (exists (
  select 1 from public.commonpick_polls p
  where p.id = poll_id and p.status = 'published'
));

drop policy if exists "Admin can view all options" on public.commonpick_options;
create policy "Admin can view all options"
on public.commonpick_options for select to authenticated
using (public.commonpick_is_admin());

drop policy if exists "Admin can create options" on public.commonpick_options;
create policy "Admin can create options"
on public.commonpick_options for insert to authenticated
with check (public.commonpick_is_admin());

drop policy if exists "Admin can update options" on public.commonpick_options;
create policy "Admin can update options"
on public.commonpick_options for update to authenticated
using (public.commonpick_is_admin())
with check (public.commonpick_is_admin());

drop policy if exists "Admin can delete options" on public.commonpick_options;
create policy "Admin can delete options"
on public.commonpick_options for delete to authenticated
using (public.commonpick_is_admin());

-- Votes: public can see totals and cast one browser-identified vote per poll.
drop policy if exists "Anyone can view vote totals" on public.commonpick_votes;
create policy "Anyone can view vote totals"
on public.commonpick_votes for select to anon, authenticated
using (true);

drop policy if exists "Anyone can cast a vote" on public.commonpick_votes;
create policy "Anyone can cast a vote"
on public.commonpick_votes for insert to anon, authenticated
with check (public.commonpick_vote_is_valid(poll_id, option_id));

-- Preserve the original fries poll and its votes.
insert into public.commonpick_polls (id, title, description, category, status)
values (
  '11111111-1111-4111-8111-111111111111',
  'Who has the best fast-food fries?',
  'There is only one way to settle it. Pick your favorite below.',
  'FOOD & DRINK',
  'published'
)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category;

insert into public.commonpick_options (poll_id, option_id, label, position)
values
  ('11111111-1111-4111-8111-111111111111','mcdonalds','McDonald''s',1),
  ('11111111-1111-4111-8111-111111111111','chick-fil-a','Chick-fil-A',2),
  ('11111111-1111-4111-8111-111111111111','five-guys','Five Guys',3),
  ('11111111-1111-4111-8111-111111111111','wendys','Wendy''s',4)
on conflict (poll_id, option_id) do update set
  label = excluded.label,
  position = excluded.position;

-- Existing one-vote-per-poll/browser uniqueness remains in place.
