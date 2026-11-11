-- Permanent assistant-generated poll draft queue.
-- Existing seed draft is imported once; running this migration again is safe.

create table if not exists public.commonpick_assistant_drafts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null default 'COMMUNITY',
  choices jsonb not null check (
    jsonb_typeof(choices) = 'array'
    and jsonb_array_length(choices) between 2 and 40
  ),
  status text not null default 'pending' check (status in ('pending', 'used')),
  poll_id uuid references public.commonpick_polls(id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

alter table public.commonpick_assistant_drafts enable row level security;
revoke all on public.commonpick_assistant_drafts from anon, authenticated;
grant select, insert, update, delete on public.commonpick_assistant_drafts to authenticated;

drop policy if exists "Admin can manage assistant drafts" on public.commonpick_assistant_drafts;
create policy "Admin can manage assistant drafts"
on public.commonpick_assistant_drafts for all to authenticated
using (public.commonpick_is_admin())
with check (public.commonpick_is_admin());

insert into public.commonpick_assistant_drafts
  (id, title, description, category, choices)
values (
  'd1b7f6a2-3c84-4e91-a5d2-8f0b6c3e7a41',
  'What is the best pizza topping?',
  'Consider flavor, texture, and how well it works on a classic pizza.',
  'FOOD & DRINK',
  '["Pepperoni","Sausage","Mushrooms","Extra cheese","Bacon","Jalapeños","Pineapple","Onions","Black olives","Green peppers","Chicken","Spinach"]'::jsonb
)
on conflict (id) do nothing;
