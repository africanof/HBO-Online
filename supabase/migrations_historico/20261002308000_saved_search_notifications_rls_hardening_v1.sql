-- RLS hardening: saved searches are owner-scoped; notifications are server-created
-- and owner-readable/updateable only. Queue is backend-written and owner-readable.
drop policy if exists "notifications_insert_own" on public.notifications;
drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
drop policy if exists "notifications_owner_read" on public.notifications;
drop policy if exists "notifications_owner_update" on public.notifications;
drop policy if exists "saved_searches_delete_own" on public.classified_saved_searches;
drop policy if exists "saved_searches_insert_own" on public.classified_saved_searches;
drop policy if exists "saved_searches_select_own" on public.classified_saved_searches;
drop policy if exists "saved_searches_update_own" on public.classified_saved_searches;
drop policy if exists "saved_searches_owner_all" on public.classified_saved_searches;
create policy "saved_searches_owner_select" on public.classified_saved_searches for select to authenticated using (user_id=auth.uid());
create policy "saved_searches_owner_insert" on public.classified_saved_searches for insert to authenticated with check (user_id=auth.uid());
create policy "saved_searches_owner_update" on public.classified_saved_searches for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "saved_searches_owner_delete" on public.classified_saved_searches for delete to authenticated using (user_id=auth.uid());
create policy "notifications_owner_select" on public.notifications for select to authenticated using (user_id=auth.uid());
create policy "notifications_owner_update" on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
