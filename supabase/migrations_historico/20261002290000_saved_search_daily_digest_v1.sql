-- Aggregate daily saved-search matches instead of silently discarding them.
create table if not exists public.saved_search_notification_queue (
  id uuid primary key default gen_random_uuid(),
  saved_search_id uuid not null references public.classified_saved_searches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.classified_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create unique index if not exists uq_saved_search_notification_queue_match
on public.saved_search_notification_queue(saved_search_id,listing_id)
where delivered_at is null;

alter table public.saved_search_notification_queue enable row level security;

drop policy if exists "saved_search_queue_select_own" on public.saved_search_notification_queue;
create policy "saved_search_queue_select_own" on public.saved_search_notification_queue
for select to authenticated using(user_id=auth.uid());

create or replace function public.flush_daily_saved_search_notifications(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=public
as $$
declare s record; inserted_count integer:=0; n integer;
begin
  for s in
    select q.saved_search_id,q.user_id,count(*) as total,
           min(q.created_at) as first_match,max(q.created_at) as last_match,
           array_agg(q.listing_id order by q.created_at) as listing_ids
    from public.saved_search_notification_queue q
    join public.classified_saved_searches ss on ss.id=q.saved_search_id
    where q.delivered_at is null
      and ss.active=true
      and coalesce(ss.notification_frequency,'immediate')='daily'
      and public.notification_type_enabled(q.user_id,'saved_search')
    group by q.saved_search_id,q.user_id
  loop
    insert into public.notifications(user_id,type,title,body,data)
    values(
      s.user_id,'saved_search',
      case when s.total=1 then 'Novo anúncio encontrado' else s.total||' novos anúncios encontrados' end,
      case when s.total=1 then 'Um novo anúncio corresponde à sua pesquisa guardada.'
           else s.total||' novos anúncios correspondem à sua pesquisa guardada.' end,
      jsonb_build_object(
        'saved_search_id',s.saved_search_id,
        'listing_ids',to_jsonb(s.listing_ids),
        'count',s.total,
        'digest',true,
        'first_match_at',s.first_match,
        'last_match_at',s.last_match
      )
    )
    on conflict do nothing;

    get diagnostics n=row_count;
    if n>0 then
      update public.saved_search_notification_queue
      set delivered_at=p_now
      where saved_search_id=s.saved_search_id
        and user_id=s.user_id
        and delivered_at is null;
      update public.classified_saved_searches
      set last_notified_at=p_now,updated_at=p_now
      where id=s.saved_search_id;
      inserted_count:=inserted_count+1;
    end if;
  end loop;
  return inserted_count;
end;
$$;

revoke execute on function public.flush_daily_saved_search_notifications(timestamptz) from public;
grant execute on function public.flush_daily_saved_search_notifications(timestamptz) to service_role;