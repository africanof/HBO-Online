-- Schedule the daily saved-search digest.
-- Requires pg_cron to be enabled in the Huambo Online Supabase project.
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'huambo-online-saved-search-daily-digest',
  '0 7 * * *',
  $$select public.flush_daily_saved_search_notifications(now());$$
)
where not exists (
  select 1 from cron.job where jobname='huambo-online-saved-search-daily-digest'
);
-- Supabase cron runs in UTC; 07:00 UTC is 08:00 Africa/Luanda (WAT).
