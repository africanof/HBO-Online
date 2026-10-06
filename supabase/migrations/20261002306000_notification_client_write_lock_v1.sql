-- Notifications are server-generated. Clients may read/update their own read state,
-- but must not manufacture notifications or queue entries.
alter table if exists public.notifications enable row level security;
drop policy if exists "notifications_insert_own" on public.notifications;

alter table if exists public.saved_search_notification_queue enable row level security;
drop policy if exists "saved_search_queue_insert_own" on public.saved_search_notification_queue;
drop policy if exists "saved_search_queue_update_own" on public.saved_search_notification_queue;

revoke insert on public.notifications from anon,authenticated;
revoke insert,update,delete on public.saved_search_notification_queue from anon,authenticated;