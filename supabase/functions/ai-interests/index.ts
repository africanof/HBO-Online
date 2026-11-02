// «✨ Novidades para si» (OpenAI gpt-4o-mini). Chamada pelo servidor ao fim do dia (pg_cron).
// A base de dados (interest_digest_queue) dá, por pessoa, um resumo do que procura e até 15 anúncios novos
// escolhidos por regras. A IA escolhe só os que fazem mesmo sentido (até 5) — ou nenhum, e então não se
// envia nada. Se a IA não estiver ativa ou falhar, usam-se os 3 melhores pelas regras.
// À IA vão só categorias, palavras pesquisadas e títulos de anúncios: nunca nomes, contactos ou mensagens.
// Só trabalha sobre a fila, por isso pode ser chamada com a chave pública sem custos extra.
import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = "gpt-4o-mini";
const reply = (body: unknown, status = 200) => Response.json(body, { status });
const clip = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

type Candidate = { id: string; title: string; category: string | null; listing_type: string; purpose: string; price: number | null; relevance: number };

const SYSTEM = `Escolhes anúncios para o aviso diário «Novidades para si» do Huambo Online (classificados do Huambo, Angola; preços em Kz).
Recebes o que a pessoa procurou e viu nos últimos 30 dias e uma lista numerada de anúncios novos.
Escolhe só os anúncios de que esta pessoa provavelmente gostaria (mesmo tipo de artigo, mesma necessidade, faixa de preço parecida).
Percebe o sentido: «carro a gasóleo» combina com uma Toyota Hilux; «casa T3» combina com «vivenda 3 quartos».
Não escolhas coisas só vagamente parecidas. Máximo 5, do mais para o menos interessante. Se nenhum servir, devolve a lista vazia.`;

const SCHEMA = {
  type: "object",
  properties: { picks: { type: "array", items: { type: "integer" } } },
  required: ["picks"],
  additionalProperties: false
};

async function pickWithAi(apiKey: string, interests: any, cands: Candidate[]): Promise<number[] | null> {
  const list = cands.map((c, i) => `${i + 1}. ${clip(c.title, 90)} · ${c.category ?? c.listing_type} · ${c.purpose}${c.price ? ` · ${c.price} Kz` : ""}`).join("\n");
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL, temperature: 0, max_tokens: 60,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Categorias de interesse: ${(interests?.categories ?? []).map((x: unknown) => clip(x, 60)).join(", ") || "—"}
Pesquisou: ${(interests?.searches ?? []).map((x: unknown) => `«${clip(x, 60)}»`).join(", ") || "—"}
Viu: ${(interests?.viewed ?? []).map((x: unknown) => `«${clip(x, 80)}»`).join(", ") || "—"}

Anúncios novos:
${list}` }
      ],
      response_format: { type: "json_schema", json_schema: { name: "escolha", strict: true, schema: SCHEMA } }
    }),
    signal: AbortSignal.timeout(20_000)
  });
  if (!r.ok) { console.error("ai-interests openai", r.status, (await r.text()).slice(0, 200)); return null; }
  const out = JSON.parse((await r.json()).choices?.[0]?.message?.content ?? "null");
  if (!out || !Array.isArray(out.picks)) return null;
  return [...new Set(out.picks.filter((n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= cands.length) as number[])].slice(0, 5);
}

Deno.serve(async req => {
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: queue, error } = await admin.rpc("interest_digest_queue", { p_limit: 100 });
  if (error) { console.error("ai-interests queue", error.message); return reply({ error: "QUEUE_FAILED" }, 500); }

  let sent = 0, skipped = 0, byAi = 0, byRules = 0;
  let aiOk = !!apiKey;
  const started = Date.now();
  for (const row of queue ?? []) {
    if (Date.now() - started > 100_000) break; // o resto fica para a próxima chamada
    const cands = (row.candidates ?? []) as Candidate[];
    if (!cands.length) continue;
    let ids: string[] | null = null;
    if (aiOk) {
      try {
        const picks = await pickWithAi(apiKey!, row.interests, cands);
        if (picks) { ids = picks.map(n => cands[n - 1].id); byAi++; }
        else aiOk = false; // a IA falhou: o resto vai pelas regras
      } catch (e) { console.error("ai-interests", String(e)); aiOk = false; }
    }
    if (ids === null) {
      // Regras: só os que combinam bem (categoria preferida e/ou palavras pesquisadas).
      ids = cands.filter(c => Number(c.relevance) >= 3).slice(0, 3).map(c => c.id); byRules++;
    }
    if (!ids.length) { skipped++; continue; }
    const r = await admin.rpc("send_interest_digest", { p_user: row.user_id, p_listing_ids: ids });
    if (r.error) { console.error("ai-interests send", r.error.message); continue; }
    if (r.data) sent++; else skipped++;
  }
  return reply({ users: queue?.length ?? 0, sent, skipped, by_ai: byAi, by_rules: byRules });
});
