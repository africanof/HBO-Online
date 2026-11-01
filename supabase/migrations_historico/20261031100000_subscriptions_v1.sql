-- Mensalidades da plataforma (iguais no Site e na APP):
-- • profissionais: 1 mês grátis, depois 2 000 Kz por mês; empresas: 1 mês grátis, depois 5 000 Kz por mês;
-- • preços, dias grátis e dados para pagamento ficam em platform_settings (a administração muda-os);
-- • enquanto não há pagamento online, o dono paga por transferência / Multicaixa Express, indica a referência
--   e junta o comprovativo; a administração confirma e o perfil fica pago até mais N meses;
-- • sem mês grátis nem pagamento em dia, o perfil deixa de aparecer ao público (não é apagado);
-- • avisos automáticos 7 dias e 1 dia antes do fim, e no dia em que termina.

create table if not exists public.platform_settings (
  id integer primary key default 1 check (id = 1),
  provider_monthly_kz numeric not null default 2000 check (provider_monthly_kz >= 0),
  business_monthly_kz numeric not null default 5000 check (business_monthly_kz >= 0),
  trial_days integer not null default 30 check (trial_days between 0 and 365),
  bank_name text, iban text, account_holder text, express_number text,
  payment_note text check (payment_note is null or char_length(payment_note) <= 500),
  updated_at timestamptz not null default now()
);
insert into public.platform_settings(id) values (1) on conflict (id) do nothing;
alter table public.platform_settings enable row level security;
create policy platform_settings_read on public.platform_settings for select to anon, authenticated using (true);
create policy platform_settings_admin_update on public.platform_settings for update to authenticated
  using ((select public.has_admin_role())) with check ((select public.has_admin_role()));
revoke all on public.platform_settings from anon, authenticated;
grant select on public.platform_settings to anon, authenticated;
grant update (provider_monthly_kz, business_monthly_kz, trial_days, bank_name, iban, account_holder, express_number, payment_note, updated_at) on public.platform_settings to authenticated;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('provider', 'business')),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid,          -- sem FK: apagar e recriar o perfil não dá outro mês grátis
  business_id uuid,
  trial_ends_at timestamptz not null,
  paid_until timestamptz,
  last_reminder text,        -- 'd7:<fim>', 'd1:<fim>', 'end:<fim>'
  created_at timestamptz not null default now(),
  check ((kind = 'provider') = (provider_id is not null) and (kind = 'business') = (business_id is not null))
);
create unique index if not exists subscriptions_provider on public.subscriptions(provider_id) where provider_id is not null;
create unique index if not exists subscriptions_business on public.subscriptions(business_id) where business_id is not null;
create index if not exists subscriptions_owner on public.subscriptions(owner_id);
alter table public.subscriptions enable row level security;
create policy subscriptions_own_read on public.subscriptions for select to authenticated using (owner_id = (select auth.uid()) or (select public.has_admin_role()));
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

create or replace function public.subscription_active_until(s public.subscriptions) returns timestamptz
language sql immutable as $$ select greatest(s.trial_ends_at, coalesce(s.paid_until, s.trial_ends_at)); $$;

-- O perfil pode aparecer ao público? (sem registo de mensalidade = sim, por segurança)
create or replace function public.subject_paid_up(p_provider uuid, p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public.subscription_active_until(s) > now() from public.subscriptions s
                   where (p_provider is not null and s.provider_id = p_provider) or (p_business is not null and s.business_id = p_business) limit 1), true);
$$;
grant execute on function public.subject_paid_up(uuid, uuid) to anon, authenticated;

-- Mês grátis automático ao criar o perfil ou a empresa.
create or replace function public.subscription_start() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_days integer := coalesce((select trial_days from public.platform_settings where id = 1), 30);
begin
  if tg_table_name = 'provider_profiles' then
    insert into public.subscriptions(kind, owner_id, provider_id, trial_ends_at) values ('provider', new.user_id, new.user_id, now() + make_interval(days => v_days))
    on conflict do nothing;
  else
    insert into public.subscriptions(kind, owner_id, business_id, trial_ends_at) values ('business', new.owner_id, new.id, now() + make_interval(days => v_days))
    on conflict do nothing;
  end if;
  return new;
end $$;
create trigger trg_subscription_start_provider after insert on public.provider_profiles for each row execute function public.subscription_start();
create trigger trg_subscription_start_business after insert on public.businesses for each row execute function public.subscription_start();
revoke all on function public.subscription_start() from public, anon, authenticated;

-- Perfis que já existam: mês grátis a contar de hoje.
insert into public.subscriptions(kind, owner_id, provider_id, trial_ends_at)
select 'provider', user_id, user_id, now() + interval '30 days' from public.provider_profiles on conflict do nothing;
insert into public.subscriptions(kind, owner_id, business_id, trial_ends_at)
select 'business', owner_id, id, now() + interval '30 days' from public.businesses on conflict do nothing;

-- Visibilidade: o público só vê perfis ativos e com mensalidade em dia; o dono e a administração veem sempre.
-- (a regra pública não usa has_admin_role(): o público sem conta não a pode chamar)
alter policy provider_profiles_public_read on public.provider_profiles using (active = true and public.subject_paid_up(user_id, null));
alter policy businesses_public_read on public.businesses using (active = true and public.subject_paid_up(null, id));
create policy provider_profiles_owner_admin_read on public.provider_profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_admin_role()));
create policy businesses_owner_admin_read on public.businesses for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.has_admin_role()));
create or replace function public.portfolio_target_public(p_provider uuid, p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case when p_provider is not null then exists (select 1 from public.provider_profiles where user_id = p_provider and active) and public.subject_paid_up(p_provider, null)
              else exists (select 1 from public.businesses where id = p_business and active) and public.subject_paid_up(null, p_business) end;
$$;

-- Pedidos de serviço só a perfis em dia.
create or replace function public.service_request_paid_up() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.subject_paid_up(new.provider_id, new.business_id) then raise exception 'PROFILE_UNAVAILABLE'; end if;
  return new;
end $$;
create trigger trg_service_request_paid_up before insert on public.service_requests for each row execute function public.service_request_paid_up();
revoke all on function public.service_request_paid_up() from public, anon, authenticated;

-- Pagamentos -------------------------------------------------------------------------------
create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  months integer not null check (months between 1 and 12),
  amount numeric not null check (amount >= 0),
  method text not null check (method in ('bank_transfer', 'multicaixa_express', 'cash')),
  reference text check (reference is null or char_length(reference) <= 120),
  proof_path text check (proof_path is null or proof_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,140}$'),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  period_end timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists subscription_payments_one_pending on public.subscription_payments(subscription_id) where status = 'pending';
create index if not exists subscription_payments_status on public.subscription_payments(status, created_at);
alter table public.subscription_payments enable row level security;
create policy subscription_payments_own_read on public.subscription_payments for select to authenticated using (owner_id = (select auth.uid()) or (select public.has_admin_role()));
revoke all on public.subscription_payments from anon, authenticated;
grant select on public.subscription_payments to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
create policy payment_proofs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy payment_proofs_read on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.has_admin_role()));

-- Os meus planos (perfil profissional e empresas).
create or replace function public.my_subscriptions()
returns table(id uuid, kind text, subject_id uuid, name text, trial_ends_at timestamptz, paid_until timestamptz, active_until timestamptz,
  state text, monthly_price numeric, pending_payment_id uuid, pending_amount numeric, last_rejected_note text)
language sql stable security definer set search_path = public as $$
  select s.id, s.kind, coalesce(s.provider_id, s.business_id),
    coalesce(case when s.kind = 'provider' then (select display_name from public.provider_profiles where user_id = s.provider_id)
                  else (select name from public.businesses where id = s.business_id) end, 'Perfil apagado'),
    s.trial_ends_at, s.paid_until, public.subscription_active_until(s),
    case when public.subscription_active_until(s) <= now() then 'expired'
         when s.paid_until is not null and s.paid_until > now() then case when s.paid_until < now() + interval '7 days' then 'expiring' else 'paid' end
         when s.trial_ends_at < now() + interval '7 days' then 'trial_ending' else 'trial' end,
    case when s.kind = 'provider' then st.provider_monthly_kz else st.business_monthly_kz end,
    p.id, p.amount,
    (select r.admin_note from public.subscription_payments r where r.subscription_id = s.id and r.status = 'rejected' order by r.decided_at desc limit 1)
  from public.subscriptions s
  cross join public.platform_settings st
  left join public.subscription_payments p on p.subscription_id = s.id and p.status = 'pending'
  where s.owner_id = auth.uid()
    and (s.kind = 'business' and exists (select 1 from public.businesses b where b.id = s.business_id)
         or s.kind = 'provider' and exists (select 1 from public.provider_profiles pp where pp.user_id = s.provider_id))
  order by s.kind desc, s.created_at;
$$;

create or replace function public.submit_subscription_payment(p_subscription_id uuid, p_months integer, p_method text, p_reference text default null, p_proof_path text default null)
returns public.subscription_payments language plpgsql security definer set search_path = public as $$
declare s public.subscriptions; st public.platform_settings; pay public.subscription_payments; ref text := nullif(left(trim(coalesce(p_reference, '')), 120), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into s from public.subscriptions where id = p_subscription_id;
  if not found or s.owner_id <> auth.uid() then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
  if p_months is null or p_months not between 1 and 12 then raise exception 'INVALID_MONTHS'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if ref is null and p_proof_path is null then raise exception 'PAYMENT_PROOF_REQUIRED'; end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_DOCUMENT'; end if;
  if exists (select 1 from public.subscription_payments where subscription_id = s.id and status = 'pending') then raise exception 'PAYMENT_PENDING'; end if;
  select * into st from public.platform_settings where id = 1;
  insert into public.subscription_payments(subscription_id, owner_id, months, amount, method, reference, proof_path)
  values (s.id, auth.uid(), p_months, p_months * case when s.kind = 'provider' then st.provider_monthly_kz else st.business_monthly_kz end, p_method, ref, p_proof_path)
  returning * into pay;
  perform public.notify_staff('Pagamento de mensalidade para confirmar', pay.amount || ' Kz · ' || p_months || ' mês(es)', jsonb_build_object('payment_id', pay.id));
  return pay;
end $$;

create or replace function public.admin_list_subscription_payments(p_status text default 'pending')
returns table(id uuid, subscription_id uuid, kind text, subject_id uuid, subject_name text, owner_id uuid, owner_name text, phone text,
  months integer, amount numeric, method text, reference text, proof_path text, status text, admin_note text, created_at timestamptz, active_until timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select p.id, s.id, s.kind, coalesce(s.provider_id, s.business_id),
    coalesce(case when s.kind = 'provider' then (select pp.display_name from public.provider_profiles pp where pp.user_id = s.provider_id)
                  else (select b.name from public.businesses b where b.id = s.business_id) end, 'Perfil apagado'),
    p.owner_id, coalesce(nullif(pr.full_name, ''), 'Utilizador'), pr.phone,
    p.months, p.amount, p.method, p.reference, p.proof_path, p.status, p.admin_note, p.created_at, public.subscription_active_until(s)
  from public.subscription_payments p join public.subscriptions s on s.id = p.subscription_id
  left join public.profiles pr on pr.id = p.owner_id
  where p_status is null or p.status = p_status
  order by (p.status = 'pending') desc, p.created_at limit 200;
end $$;

create or replace function public.admin_decide_subscription_payment(p_payment_id uuid, p_confirm boolean, p_note text default null)
returns public.subscription_payments language plpgsql security definer set search_path = public as $$
declare p public.subscription_payments; s public.subscriptions; new_end timestamptz; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into p from public.subscription_payments where id = p_payment_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if p.status <> 'pending' then raise exception 'INVALID_TRANSITION'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  select * into s from public.subscriptions where id = p.subscription_id for update;
  if p_confirm then
    new_end := greatest(now(), public.subscription_active_until(s)) + make_interval(months => p.months);
    update public.subscriptions set paid_until = new_end, last_reminder = null where id = s.id;
  end if;
  update public.subscription_payments set status = case when p_confirm then 'confirmed' else 'rejected' end, admin_note = txt,
    period_end = new_end, decided_by = auth.uid(), decided_at = now() where id = p.id returning * into p;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_confirm then 'subscription_payment_confirmed' else 'subscription_payment_rejected' end, s.kind, coalesce(s.provider_id, s.business_id),
          jsonb_build_object('payment_id', p.id, 'amount', p.amount, 'months', p.months));
  insert into public.notifications(user_id, type, title, body, data)
  values (p.owner_id, 'system', case when p_confirm then 'Pagamento confirmado ✔' else 'Pagamento não confirmado' end,
          case when p_confirm then 'A mensalidade está paga até ' || to_char(new_end at time zone 'Africa/Luanda', 'DD/MM/YYYY') || '.' else txt end,
          jsonb_build_object('payment_id', p.id, 'for', 'plan'));
  return p;
end $$;

-- Avisos diários: 7 dias e 1 dia antes do fim, e quando termina.
create or replace function public.subscription_reminders() returns integer
language plpgsql security definer set search_path = public as $$
declare s record; tag text; n integer := 0; ends timestamptz; title text; body text; price numeric;
begin
  for s in select x.*, public.subscription_active_until(x) as until,
      coalesce(case when x.kind = 'provider' then (select display_name from public.provider_profiles where user_id = x.provider_id)
                    else (select name from public.businesses where id = x.business_id) end, '') as name
    from public.subscriptions x
    where (x.kind = 'provider' and exists (select 1 from public.provider_profiles where user_id = x.provider_id))
       or (x.kind = 'business' and exists (select 1 from public.businesses where id = x.business_id)) loop
    ends := s.until;
    tag := case when ends <= now() then 'end' when ends <= now() + interval '1 day' then 'd1' when ends <= now() + interval '7 days' then 'd7' end;
    continue when tag is null or s.last_reminder = tag || ':' || ends::date;
    continue when tag = 'end' and ends < now() - interval '3 days'; -- só avisa logo a seguir ao fim
    price := (select case when s.kind = 'provider' then provider_monthly_kz else business_monthly_kz end from public.platform_settings where id = 1);
    title := case tag when 'end' then 'O seu perfil deixou de aparecer' when 'd1' then 'O seu plano termina amanhã' else 'O seu plano termina em 7 dias' end;
    body := '«' || s.name || '»: ' || case when tag = 'end' then 'pague a mensalidade de ' || price || ' Kz para voltar a aparecer aos clientes.'
                                          else (case when s.paid_until is null then 'o mês grátis' else 'o período pago' end) || ' termina a ' || to_char(ends at time zone 'Africa/Luanda', 'DD/MM/YYYY') || '. Mensalidade: ' || price || ' Kz.' end;
    insert into public.notifications(user_id, type, title, body, data) values (s.owner_id, 'system', title, body, jsonb_build_object('subscription_id', s.id, 'for', 'plan'));
    update public.subscriptions set last_reminder = tag || ':' || ends::date where id = s.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.subscription_reminders() from public, anon, authenticated;
select cron.schedule('huambo-online-subscription-reminders', '15 8 * * *', 'select public.subscription_reminders();');

revoke all on function public.my_subscriptions() from public, anon;
revoke all on function public.submit_subscription_payment(uuid, integer, text, text, text) from public, anon;
revoke all on function public.admin_list_subscription_payments(text) from public, anon;
revoke all on function public.admin_decide_subscription_payment(uuid, boolean, text) from public, anon;
grant execute on function public.my_subscriptions() to authenticated;
grant execute on function public.submit_subscription_payment(uuid, integer, text, text, text) to authenticated;
grant execute on function public.admin_list_subscription_payments(text) to authenticated;
grant execute on function public.admin_decide_subscription_payment(uuid, boolean, text) to authenticated;

-- Números no painel.
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'users_suspended', (select count(*) from public.profiles where status <> 'active'),
    'listings_published', (select count(*) from public.classified_listings where status = 'published'),
    'listings_total', (select count(*) from public.classified_listings),
    'listings_7d', (select count(*) from public.classified_listings where created_at > now() - interval '7 days'),
    'reports_open', (select count(*) from public.moderation_reports where status in ('open', 'reviewing')),
    'conversations', (select count(*) from public.conversations),
    'messages_7d', (select count(*) from public.messages where created_at > now() - interval '7 days'),
    'products_active', (select count(*) from public.products where active),
    'providers', (select count(*) from public.provider_profiles where active),
    'businesses', (select count(*) from public.businesses where active),
    'orders_30d', (select count(*) from public.orders where created_at > now() - interval '30 days'),
    'orders_completed_30d', (select count(*) from public.orders where status = 'completed' and updated_at > now() - interval '30 days'),
    'sales_value_30d', (select coalesce(sum(total), 0) from public.orders where status = 'completed' and updated_at > now() - interval '30 days'),
    'services_30d', (select count(*) from public.service_requests where created_at > now() - interval '30 days'),
    'services_done_30d', (select count(*) from public.service_requests where status in ('done', 'confirmed') and updated_at > now() - interval '30 days'),
    'deals_30d', (select count(*) from public.classified_listings where deal_at > now() - interval '30 days'),
    'reviews_30d', (select count(*) from public.user_reviews where created_at > now() - interval '30 days')
                  + (select count(*) from public.reviews where created_at > now() - interval '30 days'),
    'verifications_pending', (select count(*) from public.verification_requests where status = 'pending'),
    'disputes_open', (select count(*) from public.order_disputes where status <> 'resolved'),
    'disputes_escalated', (select count(*) from public.order_disputes where status = 'escalated'),
    'refunds_30d', (select coalesce(sum(amount), 0) from public.order_disputes where outcome = 'refunded' and resolved_at > now() - interval '30 days'),
    'plans_trial', (select count(*) from public.subscriptions s where s.trial_ends_at > now() and (s.paid_until is null or s.paid_until <= now())),
    'plans_paid', (select count(*) from public.subscriptions s where s.paid_until > now()),
    'plans_expired', (select count(*) from public.subscriptions s where public.subscription_active_until(s) <= now()),
    'plan_payments_pending', (select count(*) from public.subscription_payments where status = 'pending'),
    'plan_revenue_30d', (select coalesce(sum(amount), 0) from public.subscription_payments where status = 'confirmed' and decided_at > now() - interval '30 days')
  );
end $$;
