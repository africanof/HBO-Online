-- Classified listings as saved/favorite items
alter table public.saved_items
  add column if not exists classified_listing_id uuid references public.classified_listings(id) on delete cascade;

create unique index if not exists saved_items_user_classified_listing_uidx
  on public.saved_items(user_id, classified_listing_id)
  where classified_listing_id is not null;

create index if not exists saved_items_classified_listing_idx
  on public.saved_items(classified_listing_id)
  where classified_listing_id is not null;

alter table public.saved_items enable row level security;

drop policy if exists "saved_items_owner_select" on public.saved_items;
create policy "saved_items_owner_select" on public.saved_items
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "saved_items_owner_insert" on public.saved_items;
create policy "saved_items_owner_insert" on public.saved_items
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "saved_items_owner_delete" on public.saved_items;
create policy "saved_items_owner_delete" on public.saved_items
  for delete to authenticated using (user_id = auth.uid());
