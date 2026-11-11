-- Allow the CommonPick administrator to dismiss category recommendations.
-- Run once in Supabase > SQL Editor.

grant delete on public.commonpick_category_recommendations to authenticated;

drop policy if exists "Admin can dismiss category recommendations" on public.commonpick_category_recommendations;
create policy "Admin can dismiss category recommendations"
on public.commonpick_category_recommendations
for delete to authenticated
using (public.commonpick_is_admin());
