-- Run this entire file in Supabase > SQL Editor > New query.
create table if not exists public.commonpick_votes (
  id bigint generated always as identity primary key,
  poll_id uuid not null,
  option_id text not null check (option_id in ('mcdonalds','chick-fil-a','five-guys','wendys')),
  voter_id uuid not null,
  created_at timestamptz not null default now(),
  constraint one_vote_per_browser unique (poll_id, voter_id)
);

alter table public.commonpick_votes enable row level security;

drop policy if exists "Anyone can view vote totals" on public.commonpick_votes;
create policy "Anyone can view vote totals"
on public.commonpick_votes for select
to anon, authenticated
using (true);

drop policy if exists "Anyone can cast a vote" on public.commonpick_votes;
create policy "Anyone can cast a vote"
on public.commonpick_votes for insert
to anon, authenticated
with check (true);

-- Note: this MVP limits one vote per browser-stored voter ID, not one vote per human.
-- For a production launch, add stronger abuse prevention and server-side validation.
