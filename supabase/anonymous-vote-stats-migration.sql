-- Make the public aggregate stats recognize both legacy browser votes
-- and new Supabase anonymous/account votes. No individual vote rows are exposed.

create or replace function public.commonpick_public_vote_stats(p_voter_id uuid)
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
        and (
          mine.voter_id = p_voter_id
          or mine.user_id = auth.uid()
        )
    )
  from public.commonpick_options o
  join public.commonpick_polls p on p.id = o.poll_id
  left join option_counts c
    on c.poll_id = o.poll_id and c.option_id = o.option_id
  left join poll_totals t on t.poll_id = o.poll_id
  where p.status = 'published'
  order by o.poll_id, o.position;
$$;

revoke all on function public.commonpick_public_vote_stats(uuid) from public;
grant execute on function public.commonpick_public_vote_stats(uuid) to anon, authenticated;
