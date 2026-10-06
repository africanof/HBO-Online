-- Owner guard for saved-search creation RPC.
-- The RPC derives user_id exclusively from auth.uid(); callers cannot choose another owner.
create or replace function public.create_classified_saved_search(p_name text,p_filters jsonb)
returns public.classified_saved_searches
language plpgsql
security definer
set search_path=public
as $$
declare v public.classified_saved_searches;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if nullif(trim(coalesce(p_name,'')),'') is null then raise exception 'NAME_REQUIRED'; end if;
 if length(trim(p_name))>160 then raise exception 'NAME_TOO_LONG'; end if;
 insert into public.classified_saved_searches(user_id,name,filters)
 values(auth.uid(),trim(p_name),case when jsonb_typeof(coalesce(p_filters,'{}'::jsonb))='object' then p_filters else '{}'::jsonb end)
 returning * into v;
 return v;
end;
$$;
revoke execute on function public.create_classified_saved_search(text,jsonb) from public,anon;
grant execute on function public.create_classified_saved_search(text,jsonb) to authenticated;
