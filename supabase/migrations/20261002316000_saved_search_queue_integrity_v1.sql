-- Queue integrity: prevent duplicate pending matches and provide efficient claim scans.
create unique index if not exists uq_saved_search_notification_queue_match
on public.saved_search_notification_queue(saved_search_id,listing_id)
where delivered_at is null;

create index if not exists saved_search_queue_claim_idx
on public.saved_search_notification_queue(processing_at,created_at)
where delivered_at is null;
