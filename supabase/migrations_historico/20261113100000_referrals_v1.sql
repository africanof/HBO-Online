-- Convide um amigo (igual no Site e na APP).
-- Cada pessoa tem um código de convite (ex.: K7M2QX) e uma ligação «…/?convite=K7M2QX».
-- Quem entra pela ligação (ou escreve o código) até 14 dias depois de criar a conta fica ligado a quem convidou.
-- Quando o convidado paga a PRIMEIRA mensalidade (profissional, empresa ou loja) e a administração confirma,
-- quem convidou ganha referral_reward_days dias grátis (30 por omissão) na mensalidade que acaba primeiro; se
-- ainda não tiver mensalidade, o prémio fica guardado e entra na primeira que tiver.
-- Contra abusos: não se convida a si próprio, só um convite por conta, só contas novas, e não vale convidar
-- quem nos convidou.

alter table public.platform_settings
  add column if not exists referral_reward_days integer not null default 30 check (referral_reward_days between 0 and 365);
grant update (referral_reward_days) on public.platform_settings to authenticated;

create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  created_at timestamptz not null default now()
);
alter table public.referral_codes enable row level security;
create policy referral_codes_own_read on public.referral_codes for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.referral_codes from anon;
grant select on public.referral_codes to authenticated;

create table if not exists public.referrals (
  referred_id uuid primary key references auth.users(id) on delete cascade,
  referrer_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'joined' check (status in ('joined', 'earned', 'rewarded')),
  reward_days integer,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  created_at timestamptz not null default now(),
  earned_at timestamptz,
  rewarded_at timestamptz,
  check (referred_id <> referrer_id)
);
create index if not exists referrals_referrer_idx on public.referrals(referrer_id, status);
create index if not exists referrals_subscription_idx on public.referrals(subscription_id);
alter table public.referrals enable row level security;
create policy referrals_referrer_read on public.referrals for select to authenticated using (referrer_id = (select auth.uid()) or referred_id = (select auth.uid()));
revoke all on public.referrals from anon;
grant select on public.referrals to authenticated;

-- O meu código (cria na primeira vez).
create or replace function public.my_referral_code() returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c text; abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  select code into c from public.referral_codes where user_id = me;
  if c is not null then return c; end if;
  loop
    c := '';
    for i in 1..6 loop c := c || substr(abc, 1 + floor(random() * length(abc))::int, 1); end loop;
    begin
      insert into public.referral_codes(user_id, code) values (me, c);
      return c;
    exception when unique_violation then
      select code into c from public.referral_codes where user_id = me;
      if c is not null then return c; end if;
    end;
  end loop;
end $$;

-- Ligar a minha conta (nova) a quem me convidou.
create or replace function public.claim_referral(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); ref uuid; created timestamptz; name text;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  select user_id into ref from public.referral_codes where code = c;
  if ref is null then raise exception 'REFERRAL_NOT_FOUND'; end if;
  if ref = me then raise exception 'REFERRAL_SELF'; end if;
  if exists (select 1 from public.referrals where referred_id = me) then raise exception 'REFERRAL_ALREADY'; end if;
  select u.created_at into created from auth.users u where u.id = me;
  if created < now() - interval '14 days' then raise exception 'REFERRAL_TOO_LATE'; end if;
  if exists (select 1 from public.referrals where referred_id = ref and referrer_id = me) then raise exception 'REFERRAL_SELF'; end if;
  insert into public.referrals(referred_id, referrer_id) values (me, ref);
  select coalesce(nullif(split_part(trim(full_name), ' ', 1), ''), 'Alguém') into name from public.profiles where id = me;
  insert into public.notifications(user_id, type, title, body, data)
  values (ref, 'system', 'Convite aceite 🎉', coalesce(name, 'Alguém') || ' entrou no Huambo Online com o seu convite. Ganha um mês grátis quando pagar a primeira mensalidade.',
    jsonb_build_object('for', 'referral'));
  return (select coalesce(nullif(split_part(trim(full_name), ' ', 1), ''), 'um amigo') from public.profiles where id = ref);
end $$;

-- Dá o prémio a quem convidou: entra na mensalidade que acaba primeiro (ou fica guardado).
create or replace function public.referral_apply_reward(p_referred uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.referrals; s public.subscriptions; days int;
begin
  select * into r from public.referrals where referred_id = p_referred for update;
  if not found or r.status = 'rewarded' then return; end if;
  days := coalesce(r.reward_days, (select referral_reward_days from public.platform_settings where id = 1), 30);
  if days <= 0 then return; end if;
  select x.* into s from public.subscriptions x where x.owner_id = r.referrer_id
    order by public.subscription_active_until(x) asc limit 1 for update;
  if not found then
    if r.status = 'joined' then
      update public.referrals set status = 'earned', reward_days = days, earned_at = now() where referred_id = r.referred_id;
      insert into public.notifications(user_id, type, title, body, data)
      values (r.referrer_id, 'system', 'Ganhou 1 mês grátis 🎁', 'Quem convidou pagou a primeira mensalidade. O seu prémio de ' || days
        || ' dias fica guardado e entra na sua primeira mensalidade (profissional, empresa ou loja).', jsonb_build_object('for', 'referral'));
    end if;
    return;
  end if;
  update public.subscriptions set paid_until = greatest(now(), public.subscription_active_until(s)) + make_interval(days => days), last_reminder = null where id = s.id;
  update public.referrals set status = 'rewarded', reward_days = days, subscription_id = s.id, earned_at = coalesce(earned_at, now()), rewarded_at = now()
   where referred_id = r.referred_id;
  insert into public.notifications(user_id, type, title, body, data)
  values (r.referrer_id, 'system', 'Ganhou 1 mês grátis 🎁', 'Quem convidou pagou a primeira mensalidade: juntámos ' || days || ' dias grátis à sua mensalidade.',
    jsonb_build_object('for', 'plan'));
end $$;

-- Primeira mensalidade confirmada do convidado → prémio para quem convidou.
create or replace function public.referral_on_payment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed'
     and not exists (select 1 from public.subscription_payments x where x.owner_id = new.owner_id and x.status = 'confirmed' and x.id <> new.id) then
    perform public.referral_apply_reward(new.owner_id);
  end if;
  return new;
end $$;
create trigger referral_on_payment after update of status on public.subscription_payments
  for each row execute function public.referral_on_payment();

-- Prémios guardados entram na primeira mensalidade de quem convidou.
create or replace function public.referral_on_subscription() returns trigger
language plpgsql security definer set search_path = public as $$
declare r public.referrals;
begin
  for r in select * from public.referrals where referrer_id = new.owner_id and status = 'earned' for update loop
    update public.subscriptions set trial_ends_at = trial_ends_at + make_interval(days => coalesce(r.reward_days, 30)) where id = new.id;
    update public.referrals set status = 'rewarded', subscription_id = new.id, rewarded_at = now() where referred_id = r.referred_id;
  end loop;
  return new;
end $$;
create trigger referral_on_subscription after insert on public.subscriptions
  for each row execute function public.referral_on_subscription();

-- O meu painel de convites.
create or replace function public.my_referrals() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); created timestamptz;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  select u.created_at into created from auth.users u where u.id = me;
  return jsonb_build_object(
    'code', public.my_referral_code(),
    'reward_days', (select referral_reward_days from public.platform_settings where id = 1),
    'invited', (select count(*) from public.referrals where referrer_id = me),
    'earned', (select count(*) from public.referrals where referrer_id = me and status in ('earned', 'rewarded')),
    'days_earned', (select coalesce(sum(reward_days), 0) from public.referrals where referrer_id = me and status in ('earned', 'rewarded')),
    'waiting_days', (select coalesce(sum(reward_days), 0) from public.referrals where referrer_id = me and status = 'earned'),
    'can_claim', created >= now() - interval '14 days' and not exists (select 1 from public.referrals where referred_id = me),
    'invited_by', (select coalesce(nullif(split_part(trim(p.full_name), ' ', 1), ''), 'um amigo') from public.referrals r join public.profiles p on p.id = r.referrer_id where r.referred_id = me),
    'friends', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select coalesce(nullif(split_part(trim(p.full_name), ' ', 1), ''), 'Amigo') as name, r.status, r.reward_days, r.created_at
      from public.referrals r left join public.profiles p on p.id = r.referred_id where r.referrer_id = me order by r.created_at desc limit 100) x));
end $$;

revoke all on function public.my_referral_code() from public, anon;
revoke all on function public.claim_referral(text) from public, anon;
revoke all on function public.referral_apply_reward(uuid) from public, anon, authenticated;
revoke all on function public.referral_on_payment() from public, anon, authenticated;
revoke all on function public.referral_on_subscription() from public, anon, authenticated;
revoke all on function public.my_referrals() from public, anon;
grant execute on function public.my_referral_code() to authenticated;
grant execute on function public.claim_referral(text) to authenticated;
grant execute on function public.my_referrals() to authenticated;
