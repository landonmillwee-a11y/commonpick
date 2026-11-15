-- Attach older browser-only votes to the authenticated account.
-- Run this in Supabase SQL Editor. It does not delete or change vote choices.
create or replace function public.commonpick_claim_legacy_votes(p_voter_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_count integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to link older votes.';
  end if;

  update public.commonpick_votes legacy
  set user_id = auth.uid()
  where legacy.voter_id = p_voter_id
    and legacy.user_id is null
    and not exists (
      select 1
      from public.commonpick_votes existing
      where existing.poll_id = legacy.poll_id
        and existing.user_id = auth.uid()
    );

  get diagnostics claimed_count = row_count;
  return claimed_count;
end;
$$;

revoke all on function public.commonpick_claim_legacy_votes(uuid) from public;
grant execute on function public.commonpick_claim_legacy_votes(uuid) to authenticated;
