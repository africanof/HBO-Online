-- Harden preference RPCs: callers can only access their own row through auth.uid().
revoke all on function public.get_notification_preferences() from public;
grant execute on function public.get_notification_preferences() to authenticated;

revoke all on function public.upsert_notification_preferences(boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) from public;
grant execute on function public.upsert_notification_preferences(boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;

revoke all on function public.notification_type_enabled(uuid,text) from public;
grant execute on function public.notification_type_enabled(uuid,text) to service_role;

-- Keep the global switch semantics explicit: disabling notifications disables optional categories,
-- while system notifications remain governed by the global switch itself.
