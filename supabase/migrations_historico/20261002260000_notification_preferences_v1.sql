-- Universal per-user notification preferences.
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  saved_search boolean not null default true,
  messages boolean not null default true,
  rentals boolean not null default true,
  auctions boolean not null default true,
  marketplace boolean not null default true,
  reviews boolean not null default true,
  system boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "notification_preferences_select_own" on public.notification_preferences;
create policy "notification_preferences_select_own" on public.notification_preferences
for select to authenticated using (user_id=auth.uid());

drop policy if exists "notification_preferences_insert_own" on public.notification_preferences;
create policy "notification_preferences_insert_own" on public.notification_preferences
for insert to authenticated with check (user_id=auth.uid());

drop policy if exists "notification_preferences_update_own" on public.notification_preferences;
create policy "notification_preferences_update_own" on public.notification_preferences
for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

create or replace function public.get_notification_preferences()
returns public.notification_preferences
language sql stable security invoker
as $$ select * from public.notification_preferences where user_id=auth.uid() $$;

create or replace function public.upsert_notification_preferences(
  p_enabled boolean default true,
  p_saved_search boolean default true,
  p_messages boolean default true,
  p_rentals boolean default true,
  p_auctions boolean default true,
  p_marketplace boolean default true,
  p_reviews boolean default true,
  p_system boolean default true
)
returns public.notification_preferences
language plpgsql security invoker
as $$
declare r public.notification_preferences;
begin
  insert into public.notification_preferences(user_id,enabled,saved_search,messages,rentals,auctions,marketplace,reviews,system)
  values(auth.uid(),p_enabled,p_saved_search,p_messages,p_rentals,p_auctions,p_marketplace,p_reviews,p_system)
  on conflict(user_id) do update set
    enabled=excluded.enabled,saved_search=excluded.saved_search,messages=excluded.messages,
    rentals=excluded.rentals,auctions=excluded.auctions,marketplace=excluded.marketplace,
    reviews=excluded.reviews,system=excluded.system,updated_at=now()
  returning * into r;
  return r;
end $$;