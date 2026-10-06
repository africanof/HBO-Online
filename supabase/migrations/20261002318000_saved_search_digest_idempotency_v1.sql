-- Digest idempotency.
-- Digest notifications intentionally have no listing_id because they represent a batch.
-- Add a deterministic cycle key in data so concurrent retries can conflict.
-- The worker uses the saved-search id + digest window end as the cycle identity.
create unique index if not exists notifications_saved_search_digest_cycle_unique
on public.notifications (
  (data ->> 'saved_search_id'),
  (data ->> 'digest_cycle')
)
where type='saved_search'
  and (data ->> 'digest')='true'
  and data ? 'saved_search_id'
  and data ? 'digest_cycle';
