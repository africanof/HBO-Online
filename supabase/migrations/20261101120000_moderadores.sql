-- Moderadores: fazem tudo no painel de administração, menos mexer em contas de administrador.
--
-- • Moderador pode mudar o papel de utilizadores e moderadores (utilizador ↔ moderador).
-- • Só um administrador pode dar o papel de administrador ou alterar um administrador.
-- • Só um administrador pode suspender, banir ou reativar uma conta de administrador.
-- • A tabela user_roles deixa de poder ser escrita diretamente por moderadores
--   (antes, um moderador podia tornar-se administrador escrevendo na tabela).
-- • Cada mudança de papel fica no registo da administração (admin_audit_log).

create or replace function public.admin_set_user_role(p_user_id uuid, p_role text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  atual text;
  sou_admin boolean := public.is_admin() and public.mfa_ok();
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_role not in ('user','moderator','admin') then raise exception 'INVALID_ROLE'; end if;
  if p_user_id = auth.uid() then raise exception 'CANNOT_CHANGE_SELF'; end if;
  select role into atual from public.user_roles where user_id = p_user_id;
  if not sou_admin and (coalesce(atual, 'user') = 'admin' or p_role = 'admin') then
    raise exception 'PROTECTED_ADMIN';
  end if;
  insert into public.user_roles(user_id, role) values (p_user_id, p_role)
  on conflict (user_id) do update set role = excluded.role, updated_at = now();
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'set_role', 'user', p_user_id, jsonb_build_object('from', coalesce(atual, 'user'), 'to', p_role));
end $function$;

create or replace function public.admin_set_user_status(p_user_id uuid, p_status text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_status not in ('active','suspended','banned') then raise exception 'INVALID_STATUS'; end if;
  if p_user_id = auth.uid() then raise exception 'CANNOT_CHANGE_SELF'; end if;
  if not (public.is_admin() and public.mfa_ok())
     and exists (select 1 from public.user_roles where user_id = p_user_id and role = 'admin') then
    raise exception 'PROTECTED_ADMIN';
  end if;
  update public.profiles set status = p_status where id = p_user_id;
  if p_status <> 'active' then
    update public.classified_listings set status = 'paused' where owner_id = p_user_id and status = 'published';
  end if;
end $function$;

-- Escrita direta em user_roles: só administradores. Moderadores usam admin_set_user_role.
drop policy if exists roles_admin_manage on public.user_roles;
create policy roles_admin_manage on public.user_roles as permissive for all to authenticated
  using ((select public.is_admin()) and (select public.mfa_ok()))
  with check ((select public.is_admin()) and (select public.mfa_ok()));
