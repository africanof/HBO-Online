-- Owner-scoped UPDATE/DELETE are enforced by RLS.
-- Keep direct table writes available only to authenticated users;
-- user_id cannot be changed to another owner.
drop policy if exists "saved_searches_owner_update" on public.classified_saved_searches;
create policy "saved_searches_owner_update" on public.classified_saved_searches
for update to authenticated
using (user_id=auth.uid())
with check (user_id=auth.uid());
drop policy if exists "saved_searches_owner_delete" on public.classified_saved_searches;
create policy "saved_searches_owner_delete" on public.classified_saved_searches
for delete to authenticated
using (user_id=auth.uid());
