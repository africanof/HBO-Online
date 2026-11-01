-- Correção: a leitura direta dos contactos privados dos pedidos é só para a equipa.
-- (A regra anterior chamava uma função interna que os utilizadores não podem executar.)
-- Quem comprou continua a ver a sua morada nas listas de encomendas (my_orders*).
drop policy if exists request_private_contacts_read on public.request_private_contacts;
create policy request_private_contacts_read on public.request_private_contacts for select to authenticated
  using ((select public.has_admin_role()));
