-- Digest worker concurrency hardening.
-- The worker claims a group only when its rows are still pending/stale.
-- Keep processing_at as the lease timestamp; the existing conditional UPDATE
-- makes a second concurrent worker observe zero affected rows after the first claim.
-- Add a dedicated lease index for stale/pending scans.
create index if not exists saved_search_queue_lease_idx
on public.saved_search_notification_queue(processing_at, saved_search_id, user_id)
where delivered_at is null;
