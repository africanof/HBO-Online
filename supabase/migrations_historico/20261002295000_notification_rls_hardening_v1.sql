-- Harden notification data access and internal queue permissions.
alter table if exists public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
for select to authenticated using (user_id=auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
for update to authenticated
using (user_id=auth.uid())
with check (user_id=auth.uid());

drop policy if exists "notifications_insert_own" on public.notifications;
create policy "notifications_insert_own" on public.notifications
for insert to authenticated
with check (user_id=auth.uid());

alter table if exists public.saved_search_notification_queue enable row level security;
drop policy if exists "saved_search_queue_insert_own" on public.saved_search_notification_queue;
create policy "saved_search_queue_insert_own" on public.saved_search_notification_queue
for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "saved_search_queue_update_own" on public.saved_search_notification_queue;
create policy "saved_search_queue_update_own" on public.saved_search_notification_queue
for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

-- Client users never execute internal notification generators directly.
revoke execute on function public.create_notification(uuid,text,text,text,jsonb) from anon,authenticated;
revoke execute on function public.flush_daily_saved_search_notifications(timestamptz) from anon,authenticated;