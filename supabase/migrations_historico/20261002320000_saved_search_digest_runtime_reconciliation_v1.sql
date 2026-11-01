-- Reconcile the live Huambo Online Saved Search digest runtime.
-- pg_cron schedules are UTC; 07:00 UTC = 08:00 Africa/Luanda.
select cron.alter_job(1, schedule => '0 7 * * *');
