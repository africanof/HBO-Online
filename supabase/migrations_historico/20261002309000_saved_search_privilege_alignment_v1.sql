-- Privilege alignment: saved searches are client-manageable under owner RLS;
-- notifications/queue remain backend-generated.
grant select,insert,update,delete on public.classified_saved_searches to authenticated;
revoke insert,update,delete on public.notifications from authenticated,anon;
revoke insert,update,delete on public.saved_search_notification_queue from authenticated,anon;
grant select,update on public.notifications to authenticated;
grant select on public.saved_search_notification_queue to authenticated;
