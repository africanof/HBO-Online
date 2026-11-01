// «✨ Melhorar com IA»: reescreve o título e a descrição de um anúncio de forma clara e
// vendedora (OpenAI gpt-4o-mini). Só para quem tem sessão iniciada, no máximo 15 vezes por dia
// (contadas na base de dados). A chave OPENAI_API_KEY só existe aqui (segredo das Edge Functions),
// nunca no Site nem na APP. O texto do anúncio não é guardado por esta função.
import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = "gpt-4o-mini";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
const clip = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

const SYSTEM = `És o assistente de escrita do Huambo Online, um site de classificados do Huambo (Angola).
Recebes o rascunho de um anúncio escrito por um vendedor e reescreves o título e a descrição em português de Angola,
de forma clara, honesta, profissional e atrativa para compradores do Huambo.
Regras:
- Usa só a informação dada. NUNCA inventes características, medidas, estado, marcas, preços, garantias ou condições.
- Não exageres: mantém o estado e as qualidades tal como o vendedor disse (ex.: «bom estado» continua «bom estado», não passa a «excelente»).
- Corrige ortografia e organiza o texto (frases curtas; pode usar uma lista simples com «•» para características).
- NUNCA incluas números de telefone, WhatsApp, e-mails, moradas exatas nem links: os contactos são feitos pelas Mensagens do Huambo Online.
- Não uses MAIÚSCULAS em excesso, nem mais de 2 emojis.
- "optimized_title": no máximo 80 letras, com o essencial (o quê, marca/modelo ou tipo, e um ponto forte real).
- "optimized_description": no máximo 1200 letras.
- Se o rascunho não for um anúncio (ex.: texto ofensivo ou sem sentido), devolve o título e a descrição originais sem mudanças.`;

const SCHEMA = {
  type: "object",
  properties: { optimized_title: { type: "string" }, optimized_description: { type: "string" } },
  required: ["optimized_title", "optimized_description"],
  additionalProperties: false
};

/** Tira contactos que a IA possa ter deixado (telefones, e-mails, links). */
function stripContacts(s: string): string {
  return s.replace(/https?:\/\/\S+|www\.\S+/gi, "").replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "")
    .replace(/(\+?244[\s.-]?)?9\d{2}[\s.-]?\d{3}[\s.-]?\d{3}/g, "").replace(/[ \t]{2,}/g, " ").trim();
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return reply({ error: "AI_NOT_CONFIGURED" }, 503);

  // Quem está a pedir (sessão iniciada obrigatória).
  const auth = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false }
  });
  const { data: userData } = await supabase.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (!userData?.user) return reply({ error: "AUTH_REQUIRED" }, 401);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return reply({ error: "INVALID_INPUT" }, 400); }
  const title = clip(body.title, 140), description = String(body.description ?? "").trim().slice(0, 3000);
  if (title.length < 3 && description.length < 10) return reply({ error: "AI_NEEDS_TEXT" }, 400);
  const details = body.details && typeof body.details === "object"
    ? Object.entries(body.details as Record<string, unknown>).slice(0, 12).map(([k, v]) => `${clip(k, 30)}: ${clip(v, 60)}`).join("; ") : "";

  // Gasta um dos usos do dia (a base de dados recusa depois do limite).
  const quota = await supabase.rpc("consume_ai_writer");
  if (quota.error) {
    const limit = /AI_WRITER_LIMIT/.test(quota.error.message);
    return reply({ error: limit ? "AI_WRITER_LIMIT" : "AUTH_REQUIRED" }, limit ? 429 : 403);
  }
  const remaining = quota.data as number;

  const user = [
    `Categoria: ${clip(body.category, 80) || "—"}`, `Tipo de anúncio: ${clip(body.listingType, 30) || "—"}`,
    `Finalidade: ${clip(body.purpose, 30) || "—"}`, details ? `Dados do artigo: ${details}` : "",
    `Título original: ${title || "—"}`, `Descrição original: ${description || "—"}`
  ].filter(Boolean).join("\n");

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL, temperature: 0.6, max_tokens: 900,
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
        response_format: { type: "json_schema", json_schema: { name: "anuncio", strict: true, schema: SCHEMA } }
      }),
      signal: AbortSignal.timeout(25_000)
    });
    if (!r.ok) { console.error("generate-ad", r.status, (await r.text()).slice(0, 300)); return reply({ error: "AI_FAILED", remaining }, 502); }
    const data = await r.json();
    const out = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    const optimized_title = stripContacts(clip(out.optimized_title, 80));
    const optimized_description = stripContacts(String(out.optimized_description ?? "").trim().slice(0, 1500));
    if (!optimized_title && !optimized_description) return reply({ error: "AI_FAILED", remaining }, 502);
    return reply({ optimized_title: optimized_title || title, optimized_description: optimized_description || description, remaining });
  } catch (e) {
    console.error("generate-ad", String(e));
    return reply({ error: "AI_FAILED", remaining }, 502);
  }
});
