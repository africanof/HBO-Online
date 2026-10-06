-- RPC privilege hardening.
revoke execute on function public.create_classified_saved_search(text,jsonb) from public;
grant execute on function public.create_classified_saved_search(text,jsonb) to authenticated;
revoke execute on function public.create_notification(uuid,text,text,text,jsonb) from public,anon,authenticated;
revoke execute on function public.classified_saved_search_matches_listing(jsonb,public.classified_listings) from public,anon,authenticated;
revoke execute on function public.saved_search_territory_active(uuid,text) from public,anon,authenticated;
revoke execute on function public.notify_classified_saved_searches() from public,anon,authenticated;
revoke execute on function public.flush_daily_saved_search_notifications(timestamptz) from public,anon,authenticated;
grant execute on function public.flush_daily_saved_search_notifications(timestamptz) to service_role;
