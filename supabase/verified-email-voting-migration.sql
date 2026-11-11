-- CommonPick Step 5: verified email voting
-- Run once in Supabase > SQL Editor. Existing vote rows and totals are preserved.
-- New votes require a verified Supabase Auth account and are limited to one per account per poll.

alter table public.commonpick_votes
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists one_vote_per_user_per_poll
  on public.commonpick_votes (poll_id, user_id)
  where user_id is not null;

-- Replace the browser-ID stats function with a caller-aware version.
drop function if exists public.commonpick_public_vote_stats(uuid);

create or replace function public.commonpick_public_vote_stats()
returns table (
  poll_id uuid,
  option_id text,
  vote_count bigint,
  total_votes bigint,
  has_voted boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with option_counts as (
    select v.poll_id, v.option_id, count(*)::bigint as vote_count
    from public.commonpick_votes v
    group by v.poll_id, v.option_id
  ),
  poll_totals as (
    select v.poll_id, count(*)::bigint as total_votes
    from public.commonpick_votes v
    group by v.poll_id
  )
  select
    o.poll_id,
    o.option_id,
    coalesce(c.vote_count, 0)::bigint,
    coalesce(t.total_votes, 0)::bigint,
    exists (
      select 1
      from public.commonpick_votes mine
      where mine.poll_id = o.poll_id
        and mine.user_id = auth.uid()
    )
  from public.commonpick_options o
  join public.commonpick_polls p on p.id = o.poll_id
  left join option_counts c
    on c.poll_id = o.poll_id and c.option_id = o.option_id
  left join poll_totals t on t.poll_id = o.poll_id
  where p.status = 'published'
  order by o.poll_id, o.position;
$$;

revoke all on function public.commonpick_public_vote_stats() from public;
grant execute on function public.commonpick_public_vote_stats() to anon, authenticated;

-- Require an authenticated account for all new votes.
drop policy if exists "Anyone can cast a vote" on public.commonpick_votes;
drop policy if exists "Verified users can cast a vote" on public.commonpick_votes;

revoke insert on public.commonpick_votes from anon;
grant insert on public.commonpick_votes to authenticated;

create policy "Verified users can cast a vote"
on public.commonpick_votes for insert to authenticated
with check (
  auth.uid() = user_id
  and public.commonpick_vote_is_valid(poll_id, option_id)
);

