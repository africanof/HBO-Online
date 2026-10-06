-- Ensure saved-search ownership is enforced at the database boundary.
alter table if exists public.classified_saved_searches enable row level security;

drop policy if exists "saved_searches_select_own" on public.classified_saved_searches;
create policy "saved_searches_select_own" on public.classified_saved_searches
for select to authenticated using (user_id=auth.uid());

drop policy if exists "saved_searches_insert_own" on public.classified_saved_searches;
create policy "saved_searches_insert_own" on public.classified_saved_searches
for insert to authenticated with check (user_id=auth.uid());

drop policy if exists "saved_searches_update_own" on public.classified_saved_searches;
create policy "saved_searches_update_own" on public.classified_saved_searches
for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists "saved_searches_delete_own" on public.classified_saved_searches;
create policy "saved_searches_delete_own" on public.classified_saved_searches
for delete to authenticated using (user_id=auth.uid());

create index if not exists idx_classified_saved_searches_user_active
on public.classified_saved_searches(user_id,active);

create index if not exists idx_classified_saved_searches_frequency
on public.classified_saved_searches(notification_frequency,active);