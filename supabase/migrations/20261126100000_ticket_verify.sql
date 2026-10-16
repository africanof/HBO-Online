-- 🎟️ O QR do bilhete passa a levar o endereço /eventos/bilhete/<código>: qualquer telemóvel abre a página.
-- O organizador vê o nome e pode deixar entrar; quem comprou vê o seu bilhete; outra pessoa só sabe se é verdadeiro.
create or replace function public.ticket_by_code(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t public.event_tickets; e public.events; me uuid := auth.uid(); role_ text; tn text; holder text;
  c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if c like 'HO%' then c := substr(c, 3); end if;
  if char_length(c) <> 8 then return jsonb_build_object('result', 'invalid'); end if;
  c := 'HO-' || substr(c, 1, 4) || '-' || substr(c, 5, 4);
  select * into t from public.event_tickets where code = c;
  if not found then return jsonb_build_object('result', 'invalid'); end if;
  select * into e from public.events where id = t.event_id;
  role_ := case when me is not null and e.organizer_id = me then 'organizer' when me is not null and public.has_admin_role() then 'admin'
                when me is not null and t.holder_id = me then 'holder' else 'other' end;
  if role_ = 'other' then
    return jsonb_build_object('result', 'ok', 'role', role_, 'code', c, 'status', t.status, 'event_id', e.id, 'event_title', e.title, 'starts_at', e.starts_at, 'event_status', e.status);
  end if;
  select name into tn from public.event_ticket_types where id = t.ticket_type_id;
  select buyer_name into holder from public.event_orders where id = t.order_id;
  return jsonb_build_object('result', 'ok', 'role', role_, 'code', c, 'status', t.status, 'event_id', e.id, 'event_title', e.title, 'starts_at', e.starts_at,
    'venue', e.venue, 'event_status', e.status, 'type', tn, 'holder', holder, 'checked_in_at', t.checked_in_at);
end $$;
revoke all on function public.ticket_by_code(text) from public;
grant execute on function public.ticket_by_code(text) to anon, authenticated;
