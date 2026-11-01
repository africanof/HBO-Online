-- Correção: na cópia para o projeto novo perderam-se as permissões de uso dos contadores
-- (sequências) do esquema public. Sem elas, quem tem sessão iniciada não conseguia criar
-- postos, eventos, reservas, inspeções, promoções, etc. (erro «permission denied for sequence»).
-- Repõe o que o Supabase dá por omissão às funções «authenticated» e «service_role».
grant usage, select on all sequences in schema public to authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;
