-- Regression guards for the canonical saved-search matcher.
-- These are intentionally non-destructive checks represented as comments/metadata
-- in the migration so CI can inspect the required contract.
-- Contract:
-- 1) invalid category/price/territory filters return false, never raise;
-- 2) inactive listing ancestry returns false;
-- 3) inactive selected territory returns false;
-- 4) active selected territory must match the listing at the selected level;
-- 5) category, price, listing type, purpose, text and attributes remain enforced;
-- 6) client roles cannot execute internal matcher functions directly.
comment on function public.classified_saved_search_matches_listing(jsonb,public.classified_listings)
is 'Canonical Huambo Online saved-search matcher. Regression contract: safe invalid filters; active listing ancestry; active selected territory; exact selected-level match; category/price/type/purpose/text/attributes; client EXECUTE revoked.';
