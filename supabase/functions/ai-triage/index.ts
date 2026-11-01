// Triagem automática dos anúncios (OpenAI gpt-4o-mini). Chamada pelo servidor a cada 10 minutos
// (pg_cron): pega nos anúncios publicados ou alterados que ainda não foram vistos, pede à IA uma
// avaliação de risco e guarda-a em listing_ai_reviews. A IA só ASSINALA: quem decide é a equipa.
// Risco alto avisa a equipa (notify_staff). Só trabalha sobre a fila, por isso pode ser chamada
// com a chave pública sem custos extra.
import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = "gpt-4o-mini";
const reply = (body: unknown, status = 200) => Response.json(body, { status });
const clip = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

const SYSTEM = `És o moderador automático do Huambo Online, um site de classificados do Huambo (Angola). Preços em kwanzas (Kz).
Avalias um anúncio e dizes à equipa humana se merece atenção. NÃO decides nada: só assinalas.
"risk":
- "high": provável burla ou conteúdo proibido (armas, drogas, documentos falsos, animais protegidos, conteúdo sexual,
  pedir pagamento adiantado fora do site, pedir dados bancários/cartões, preço absurdamente baixo para o artigo, ofertas de emprego que pedem dinheiro ao candidato).
- "attention": contactos escondidos no texto (números por extenso como "nove dois três…", "zap", e-mails, links, redes sociais),
  categoria claramente errada, preço muito estranho, texto ofensivo, texto sem sentido ou anúncio duplicado/spam.
- "ok": tudo normal. Na dúvida entre ok e attention, escolhe ok.
"reasons": até 4 motivos curtos em português (vazio se ok). "suggested_category": nome da categoria certa se a atual estiver errada, senão null.
"summary": uma frase para a equipa (ou "" se ok).`;

const SCHEMA = {
  type: "object",
  properties: {
    risk: { type: "string", enum: ["ok", "attention", "high"] },
    reasons: { type: "array", items: { type: "string" } },
    suggested_category: { type: ["string", "null"] },
    summary: { type: "string" }
  },
  required: ["risk", "reasons", "suggested_category", "summary"],
  additionalProperties: false
};

Deno.serve(async req => {
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return reply({ error: "AI_NOT_CONFIGURED" }, 503);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const { data: queue, error } = await admin.rpc("ai_triage_queue", { p_limit: 15 });
  if (error) { console.error("ai-triage queue", error.message); return reply({ error: "QUEUE_FAILED" }, 500); }
  // As categorias são públicas: lidas com a chave pública (o service_role só usa funções).
  const pub = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
  const { data: cats } = await pub.from("categories").select("name").eq("type", "classified").eq("active", true);
  const categoryNames = (cats ?? []).map(c => c.name).join(", ");

  let done = 0, flagged = 0;
  for (const l of queue ?? []) {
    try {
      const daysOld = l.owner_created_at ? Math.floor((Date.now() - Date.parse(l.owner_created_at)) / 86_400_000) : null;
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL, temperature: 0, max_tokens: 300,
          messages: [
            { role: "system", content: SYSTEM + `\nCategorias existentes: ${categoryNames}` },
            { role: "user", content: `Tipo: ${l.listing_type} · Finalidade: ${l.purpose} · Categoria: ${l.category_name ?? "—"}
Preço: ${l.price ?? "—"} Kz · Conta criada há ${daysOld ?? "?"} dias
Dados: ${clip(JSON.stringify(l.attributes ?? {}), 400)}
Título: ${clip(l.title, 200)}
Descrição: ${clip(l.description, 2500)}` }
          ],
          response_format: { type: "json_schema", json_schema: { name: "triagem", strict: true, schema: SCHEMA } }
        }),
        signal: AbortSignal.timeout(20_000)
      });
      if (!r.ok) { console.error("ai-triage openai", r.status, (await r.text()).slice(0, 200)); break; }
      const data = await r.json();
      const out = JSON.parse(data.choices?.[0]?.message?.content ?? "null");
      if (!out) continue;
      const risk = ["ok", "attention", "high"].includes(out.risk) ? out.risk : "ok";
      const save = await admin.rpc("ai_save_review", {
        p_listing_id: l.id, p_source_hash: l.source_hash, p_risk: risk,
        p_reasons: (out.reasons ?? []).slice(0, 4).map((x: unknown) => clip(x, 160)),
        p_suggested_category: out.suggested_category ? clip(out.suggested_category, 80) : null, p_summary: clip(out.summary, 400)
      });
      if (save.error) { console.error("ai-triage save", save.error.message); continue; }
      done++; if (risk !== "ok") flagged++;
    } catch (e) { console.error("ai-triage", String(e)); }
  }
  return reply({ checked: done, flagged });
});
