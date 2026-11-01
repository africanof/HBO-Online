-- 1) Várias contas para receber pagamentos (bancos e Multicaixa Express), mostradas a quem paga.
-- 2) Relatório de receitas para a administração: mensalidades e comissões confirmadas, por período.

alter table public.platform_settings add column if not exists payment_accounts jsonb not null default '[]'::jsonb
  check (jsonb_typeof(payment_accounts) = 'array' and jsonb_array_length(payment_accounts) <= 6);
grant update (payment_accounts) on public.platform_settings to authenticated;

-- Passa a conta já guardada (e a 2.ª conta que estava na nota) para a lista.
update public.platform_settings set
  payment_accounts = jsonb_build_array(
    jsonb_build_object('bank', 'Banco Yetu', 'iban', '0066 0000 07341533101 37', 'holder', 'Aires Cláudio Festo'),
    jsonb_build_object('bank', 'Standard Bank', 'iban', '0060 0101 01004635117 68', 'holder', 'Aires Cláudio Festo')),
  payment_note = null, updated_at = now()
where id = 1 and jsonb_array_length(payment_accounts) = 0 and iban = '0066 0000 07341533101 37';

-- Receitas confirmadas (mensalidades e comissões) entre duas datas (hora de Angola).
create or replace function public.admin_revenue(p_from date, p_to date)
returns table(paid_at timestamptz, kind text, description text, payer_name text, amount numeric, method text, reference text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then raise exception 'INVALID_PERIOD'; end if;
  return query
  select p.decided_at, 'plan_' || s.kind, public.plan_subject_name(s) || ' · ' || p.months || case when p.months = 1 then ' mês' else ' meses' end,
         coalesce(nullif(pr.full_name, ''), 'Utilizador'), p.amount, p.method, p.reference
  from public.subscription_payments p join public.subscriptions s on s.id = p.subscription_id left join public.profiles pr on pr.id = p.owner_id
  where p.status = 'confirmed' and (p.decided_at at time zone 'Africa/Luanda')::date between p_from and p_to
  union all
  select c.decided_at, 'commission', c.listing_title || ' · venda ' || c.sale_amount || ' Kz', coalesce(nullif(pr.full_name, ''), 'Utilizador'), c.amount, c.method, c.reference
  from public.listing_commissions c left join public.profiles pr on pr.id = c.owner_id
  where c.status = 'paid' and (c.decided_at at time zone 'Africa/Luanda')::date between p_from and p_to
  order by 1 desc;
end $$;
revoke all on function public.admin_revenue(date, date) from public, anon;
grant execute on function public.admin_revenue(date, date) to authenticated;
