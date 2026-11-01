-- Arrendamento de imóveis grátis e sem comissões (para trazer mais pessoas ao Site e à APP).
-- Anúncios de imóveis para arrendar ou alugar (purpose rent/lease) não geram comissão:
-- nem ao marcar «Arrendado», nem ao aceitar um pedido de aluguer. Vendas continuam com comissão.
create or replace function public.listing_commission_free(l public.classified_listings)
 returns boolean
 language sql
 immutable
 set search_path to 'public'
as $function$
  select l.listing_type = 'real_estate' and l.purpose in ('rent', 'lease');
$function$;
revoke all on function public.listing_commission_free(public.classified_listings) from public, anon, authenticated;

do $$
declare def text;
begin
  def := pg_get_functiondef('public.listing_commission_add(public.classified_listings, numeric, text, uuid)'::regprocedure);
  if position('listing_commission_free' in def) = 0 then
    def := replace(def,
      '  select * into st from public.platform_settings where id = 1;',
      '  if public.listing_commission_free(l) then return; end if; -- arrendamento de imóveis: grátis' || chr(10) ||
      '  select * into st from public.platform_settings where id = 1;');
    if position('listing_commission_free' in def) = 0 then raise exception 'listing_commission_add: texto não encontrado'; end if;
    execute def;
  end if;
end $$;

-- Comissões de arrendamento de imóveis que estivessem por pagar ficam anuladas.
update public.listing_commissions c set status = 'cancelled', admin_note = coalesce(c.admin_note, 'Arrendamento de imóveis passou a ser grátis.')
from public.classified_listings l
where l.id = c.listing_id and c.status = 'due' and c.source in ('rental', 'rented') and public.listing_commission_free(l);
