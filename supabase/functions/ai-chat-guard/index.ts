// Revisão das mensagens com IA (OpenAI gpt-4o-mini): procura contactos DISFARÇADOS que as regras fixas da
// base de dados não apanham (ex.: «o meu verde é nove-dois-três…», números partidos, «procura-me no face
// como Joana Vendas Huambo», dados bancários escritos de outra forma). Chamada pelo servidor a cada minuto
// (pg_cron), só quando há mensagens com números ou palavras suspeitas (ver ai_chat_queue). Se a IA
// encontrar contactos, ai_chat_verdict retira a mensagem à outra parte e avisa quem a escreveu.
import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = "gpt-4o-mini";
const reply = (body: unknown, status = 200) => Response.json(body, { status });

const SYSTEM = `És o filtro de segurança das mensagens do Huambo Online, um mercado online de Angola.
Compradores e vendedores podem conversar sobre o artigo, o preço, o estado, a entrega e o local de encontro.
NÃO podem trocar contactos nem pagar fora da plataforma. Decide se a MENSAGEM NOVA (lida junto com as mensagens anteriores da mesma pessoa) tenta passar:
- telefone ou número de Multicaixa Express (também por extenso, com letras, partido em várias mensagens, com espaços ou símbolos);
- e-mail, ligação, perfil ou nome de utilizador em redes sociais (WhatsApp, Facebook, Instagram, TikTok, Telegram…), mesmo disfarçado ("verde", "zap", "face");
- IBAN, NIB, número de conta bancária ou pedido para pagar por transferência direta ao vendedor.
NÃO é contacto: preços, quantidades, quilómetros, anos, datas, horas, medidas, referências de anúncio (ex.: A-1023), nomes de bairros, ruas ou pontos de encontro públicos.
Em caso de dúvida razoável, "contact" = false.`;

const NAME_SYSTEM = `Verificas o NOME PÚBLICO que um utilizador do Huambo Online (mercado online de Angola) escolheu para os outros verem.
O objetivo é que ninguém consiga encontrar a pessoa fora da plataforma. Recusa ("ok": false) se o nome público:
- tiver telefone, e-mail, ligação, @utilizador ou referência a WhatsApp, Facebook, Instagram, TikTok ou outra rede social (mesmo disfarçada);
- for o nome verdadeiro completo da pessoa, ou tiver o apelido (sobrenome) dela, ou permitir identificá-la facilmente nas redes sociais;
- for ofensivo ou se fizer passar pela equipa do Huambo Online.
Aceita alcunhas e nomes comerciais simples (ex.: "Vendas do Bairro", "Tia Rosa", "Kapango Motors"), mesmo com o primeiro nome da pessoa.`;

const SCHEMA = {
  type: "object",
  properties: {
    contact: { type: "boolean" },
    kind: { type: "string", enum: ["phone", "email", "social", "link", "bank", "offplatform", "none"] }
  },
  required: ["contact", "kind"],
  additionalProperties: false
};

Deno.serve(async req => {
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return reply({ error: "AI_NOT_CONFIGURED" }, 503);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: queue, error } = await admin.rpc("ai_chat_queue", { p_limit: 20 });
  if (error) { console.error("ai-chat-guard queue", error.message); return reply({ error: "QUEUE_FAILED" }, 500); }

  let checked = 0, blocked = 0;
  for (const q of (queue ?? []) as { message_id: string; body: string; context: string | null }[]) {
    try {
      const user = (q.context ? `Mensagens anteriores da mesma pessoa (últimos 30 minutos):\n${q.context.slice(0, 1500)}\n\n` : "") + `MENSAGEM NOVA:\n${q.body.slice(0, 1500)}`;
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL, temperature: 0, max_tokens: 60,
          messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
          response_format: { type: "json_schema", json_schema: { name: "verdict", strict: true, schema: SCHEMA } }
        }),
        signal: AbortSignal.timeout(20_000)
      });
      if (!r.ok) { console.error("ai-chat-guard openai", r.status, (await r.text()).slice(0, 200)); continue; } // tenta outra vez no minuto seguinte
      const out = JSON.parse((await r.json())?.choices?.[0]?.message?.content ?? "{}");
      const contact = out.contact === true && out.kind !== "none";
      const v = await admin.rpc("ai_chat_verdict", { p_message_id: q.message_id, p_contact: contact, p_kind: contact ? out.kind : null });
      if (v.error) { console.error("ai-chat-guard verdict", v.error.message); continue; }
      checked++; if (contact) blocked++;
    } catch (e) { console.error("ai-chat-guard", String(e).slice(0, 200)); }
  }
  // Nomes públicos novos: sem contactos, redes sociais nem o nome verdadeiro da pessoa.
  let names = 0, refused = 0;
  const nq = await admin.rpc("ai_name_queue", { p_limit: 20 });
  for (const q of (nq.data ?? []) as { user_id: string; public_name: string; full_name: string | null }[]) {
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL, temperature: 0, max_tokens: 30,
          messages: [{ role: "system", content: NAME_SYSTEM }, { role: "user", content: `Nome verdadeiro: ${q.full_name ?? "(desconhecido)"}\nNome público escolhido: ${q.public_name}` }],
          response_format: { type: "json_schema", json_schema: { name: "name_check", strict: true, schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false } } }
        }),
        signal: AbortSignal.timeout(20_000)
      });
      if (!r.ok) continue;
      const ok = JSON.parse((await r.json())?.choices?.[0]?.message?.content ?? "{}").ok !== false;
      const v = await admin.rpc("ai_name_verdict", { p_user: q.user_id, p_ok: ok });
      if (!v.error) { names++; if (!ok) refused++; }
    } catch (e) { console.error("ai-chat-guard name", String(e).slice(0, 200)); }
  }
  return reply({ checked, blocked, names, refused });
});
