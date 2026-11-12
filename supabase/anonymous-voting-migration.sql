-- CommonPick account-aware voting foundation.
-- Preserves all existing votes. Existing rows keep user_id = NULL.
-- Run in Supabase SQL Editor before deploying the anonymous-voting app update.

alter table public.commonpick_votes
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- A Supabase identity can vote only once per poll, even if it uses multiple browsers.
create unique index if not exists one_vote_per_user_per_poll
  on public.commonpick_votes (poll_id, user_id)
  where user_id is not null;

-- Votes must be attached to the currently authenticated Supabase identity.
-- Anonymous Supabase users still use the authenticated database role.
drop policy if exists "Anyone can cast a vote" on public.commonpick_votes;

revoke insert on public.commonpick_votes from anon;
grant insert on public.commonpick_votes to authenticated;

create policy "Authenticated visitors can cast a vote"
on public.commonpick_votes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.commonpick_vote_is_valid(poll_id, option_id)
);
