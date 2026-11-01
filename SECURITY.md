# Política de segurança

## Comunicar uma vulnerabilidade

**Não abra uma issue pública.** Use a comunicação privada do GitHub:
separador **Security → Report a vulnerability** neste repositório.

Inclua, se possível:

- descrição do problema e impacto;
- passos para reproduzir;
- páginas, ecrãs ou endpoints afetados.

Respondemos assim que possível e mantemos quem comunicou informado até à correção.

## Regras do projeto

- Chaves secretas (`service_role`, tokens de API, chaves de pagamento) **nunca** entram no repositório, no Site nem na APP.
- O Site e a APP usam apenas a chave **pública** do Supabase, através de variáveis de ambiente.
- Permissões são aplicadas no backend com RLS; a interface nunca é a única barreira.
- Segredos de servidor vivem nos segredos das Edge Functions do Supabase ou nos *GitHub Secrets*.
