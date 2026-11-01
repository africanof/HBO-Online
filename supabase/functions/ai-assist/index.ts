// Assistente de IA do Huambo Online (OpenAI gpt-4o-mini). Uma só função com várias tarefas:
//   photo_fill       — a partir de uma fotografia, propõe título, descrição, categoria e campos do anúncio
//   smart_search     — transforma «carro diesel até 5 milhões» em filtros da pesquisa
//   help             — responde a dúvidas com base na Ajuda, nos Termos e na Privacidade
//   translate        — traduz um anúncio (en/zh/pt) e guarda a tradução para os próximos
//   staff_reply      — (equipa) sugere uma resposta numa conversa mediada
//   dispute_summary  — (equipa) resume uma disputa antes da decisão
// Limites diários por pessoa na base de dados (consume_ai). A chave OPENAI_API_KEY só existe aqui.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { KNOWLEDGE } from "./knowledge.ts";

const MODEL = "gpt-4o-mini";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
const clip = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const text = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const LANG_NAMES: Record<string, string> = { pt: "português de Angola", en: "English", zh: "简体中文 (Simplified Chinese)" };

/** Tira contactos (telefones, e-mails, links) — os contactos fazem-se pelas Mensagens. */
function stripContacts(s: string): string {
  return s.replace(/https?:\/\/\S+|www\.\S+/gi, "").replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "")
    .replace(/(\+?244[\s.-]?)?9\d{2}[\s.-]?\d{3}[\s.-]?\d{3}/g, "").replace(/[ \t]{2,}/g, " ").trim();
}

type Msg = { role: "system" | "user" | "assistant"; content: unknown };
async function chat(apiKey: string, messages: Msg[], schema: Record<string, unknown>, opts: { temperature?: number; max_tokens?: number } = {}) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL, temperature: opts.temperature ?? 0.3, max_tokens: opts.max_tokens ?? 900, messages,
      response_format: { type: "json_schema", json_schema: { name: "resposta", strict: true, schema } }
    }),
    signal: AbortSignal.timeout(28_000)
  });
  if (!r.ok) throw new Error(`openai ${r.status} ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  const m = data.choices?.[0]?.message;
  if (m?.refusal) return null;
  return JSON.parse(m?.content ?? "null");
}
const obj = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const str = { type: "string" };
const strOrNull = { type: ["string", "null"] };
const numOrNull = { type: ["number", "null"] };

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return reply({ error: "AI_NOT_CONFIGURED" }, 503);

  let body: Record<string, any> = {};
  try { body = await req.json(); } catch { return reply({ error: "INVALID_INPUT" }, 400); }
  const task = String(body.task ?? "");

  const auth = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  try {
    // Tradução: qualquer visitante; cada anúncio é traduzido uma só vez por idioma (fica guardado).
    if (task === "translate") {
      const listingId = String(body.listingId ?? ""), lang = String(body.lang ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(listingId) || !LANG_NAMES[lang]) return reply({ error: "INVALID_INPUT" }, 400);
      const { data: l } = await admin.from("classified_listings").select("title,description,status").eq("id", listingId).maybeSingle();
      if (!l || !["published", "sold", "rented"].includes(l.status)) return reply({ error: "NOT_FOUND" }, 404);
      const { data: hash } = await admin.rpc("listing_text_hash", { p_listing_id: listingId });
      const { data: cached } = await admin.from("listing_translations").select("title,description,source_hash").eq("listing_id", listingId).eq("lang", lang).maybeSingle();
      if (cached && cached.source_hash === hash) return reply({ title: cached.title, description: cached.description, cached: true });
      const out = await chat(apiKey, [
        { role: "system", content: `Translate this classified ad from Huambo (Angola) into ${LANG_NAMES[lang]}. Keep prices, numbers, units, brand and place names exactly as they are. Do not add or remove information. Return JSON with "title" and "description".` },
        { role: "user", content: `Title: ${text(l.title, 200)}\n\nDescription:\n${text(l.description, 4000)}` }
      ], obj({ title: str, description: str }), { temperature: 0.1, max_tokens: 1800 });
      if (!out?.title) return reply({ error: "AI_FAILED" }, 502);
      const t = { title: clip(out.title, 200), description: text(out.description, 6000) };
      await admin.from("listing_translations").upsert({ listing_id: listingId, lang, source_hash: hash, ...t, created_at: new Date().toISOString() });
      return reply({ ...t, cached: false });
    }

    // As outras tarefas precisam de sessão iniciada e gastam um uso do dia.
    const { data: userData } = await supabase.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!userData?.user) return reply({ error: "AUTH_REQUIRED" }, 401);
    const FEATURES: Record<string, string> = { photo_fill: "photo_fill", smart_search: "smart_search", help: "help", staff_reply: "staff_reply", dispute_summary: "dispute_summary" };
    const feature = FEATURES[task];
    if (!feature) return reply({ error: "INVALID_INPUT" }, 400);

    // Validar a entrada antes de gastar o uso.
    if (task === "photo_fill") {
      const image = String(body.image ?? "").replace(/^data:[^,]*,/, ""), mediaType = String(body.mediaType ?? "image/jpeg");
      if (!image || image.length > 2_000_000 || !IMAGE_TYPES.includes(mediaType)) return reply({ error: "INVALID_IMAGE" }, 400);
    }
    if ((task === "smart_search" || task === "help") && clip(body.query ?? body.question, 10).length < 2) return reply({ error: "AI_NEEDS_TEXT" }, 400);

    const quota = await supabase.rpc("consume_ai", { p_feature: feature });
    if (quota.error) {
      const m = quota.error.message;
      const code = /AI_LIMIT/.test(m) ? "AI_LIMIT" : /ADMIN_ONLY/.test(m) ? "ADMIN_ONLY" : /ACCOUNT_SUSPENDED/.test(m) ? "ACCOUNT_SUSPENDED" : "AUTH_REQUIRED";
      return reply({ error: code }, code === "AI_LIMIT" ? 429 : 403);
    }
    const remaining = quota.data as number;

    if (task === "photo_fill") {
      const image = String(body.image).replace(/^data:[^,]*,/, ""), mediaType = String(body.mediaType ?? "image/jpeg");
      const out = await chat(apiKey, [
        { role: "system", content: `És o assistente de publicação do Huambo Online (classificados do Huambo, Angola). Olhas para a fotografia de um artigo que alguém quer vender ou arrendar e propões o anúncio em português de Angola.
Regras:
- Descreve só o que se vê na fotografia; não inventes estado, medidas, ano, preço nem garantias. Se algo não se vê, deixa null.
- "title": até 70 letras, simples (ex.: "Frigorífico Samsung de 2 portas").
- "description": 2 a 4 frases curtas sobre o que se vê; termina com uma frase a convidar o vendedor a completar (estado, defeitos). Sem contactos.
- "listing_type": product, vehicle, real_estate, service ou classified.
- "category_slug": um dos slugs do catálogo, ou null.
- "details": lista de pares {key, value} só com chaves do catálogo e valores permitidos (nas listas usa exatamente uma das opções).
- Se a fotografia não mostrar um artigo para vender (ex.: só pessoas), "found" = false.
- Não descrevas nem identifiques pessoas.
Catálogo (categorias e campos):
${text(body.catalog, 7000)}` },
        { role: "user", content: [
          { type: "image_url", image_url: { url: `data:${mediaType};base64,${image}`, detail: "low" } },
          { type: "text", text: "Propõe o anúncio para este artigo." }
        ] }
      ], obj({ found: { type: "boolean" }, title: str, description: str, listing_type: str, category_slug: strOrNull,
        details: { type: "array", items: obj({ key: str, value: str }) } }), { temperature: 0.2, max_tokens: 700 });
      if (!out) return reply({ found: false, remaining });
      const details: Record<string, string> = {};
      for (const d of (out.details ?? []).slice(0, 12)) if (d?.key && d?.value) details[clip(d.key, 30)] = clip(d.value, 60);
      return reply({ found: !!out.found, title: stripContacts(clip(out.title, 80)), description: stripContacts(text(out.description, 1200)),
        listing_type: clip(out.listing_type, 20), category_slug: out.category_slug ? clip(out.category_slug, 60) : null, details, remaining });
    }

    if (task === "smart_search") {
      const out = await chat(apiKey, [
        { role: "system", content: `Transformas um pedido de pesquisa (em qualquer língua) em filtros para os classificados do Huambo Online (Angola). Preços em kwanzas (Kz): "5 milhões" = 5000000, "500 mil" = 500000.
- "keywords": as palavras do artigo a procurar em português (ex.: "Toyota Hilux", "frigorífico"), sem preço, sem local nem palavras como "barato"; "" se não houver.
- "listing_type": product, vehicle, real_estate, service, classified ou null.
- "purpose": sale (comprar), rent (arrendar/alugar), wanted, service, auction ou null.
- "category_slug": um slug do catálogo ou null. "min_price"/"max_price": números ou null.
- "attributes": pares {key, value} só com chaves de lista do catálogo e valores permitidos (ex.: fuel=gasoleo).
Catálogo:
${text(body.catalog, 7000)}` },
        { role: "user", content: clip(body.query, 300) }
      ], obj({ keywords: str, listing_type: strOrNull, purpose: strOrNull, category_slug: strOrNull, min_price: numOrNull, max_price: numOrNull,
        attributes: { type: "array", items: obj({ key: str, value: str }) } }), { temperature: 0, max_tokens: 300 });
      if (!out) return reply({ error: "AI_FAILED", remaining }, 502);
      const attributes: Record<string, string> = {};
      for (const a of (out.attributes ?? []).slice(0, 8)) if (a?.key && a?.value) attributes[clip(a.key, 30)] = clip(a.value, 40);
      return reply({ keywords: clip(out.keywords, 80), listing_type: out.listing_type, purpose: out.purpose, category_slug: out.category_slug,
        min_price: out.min_price, max_price: out.max_price, attributes, remaining });
    }

    if (task === "help") {
      const lang = LANG_NAMES[String(body.lang)] ? String(body.lang) : "pt";
      const history = Array.isArray(body.history) ? body.history.slice(-6).map((h: any) => ({ role: h?.role === "assistant" ? "assistant" : "user", content: clip(h?.content, 800) })) : [];
      const out = await chat(apiKey, [
        { role: "system", content: `És o assistente de ajuda do Huambo Online (Site e APP de classificados, loja e serviços do Huambo, Angola). Respondes em ${LANG_NAMES[lang]}, de forma curta (até 6 frases), simples e simpática.
- Usa só a informação abaixo. Se a resposta não estiver lá, ou se for um problema com uma conta, pagamento ou pedido concreto, diz que não sabes e põe "handoff" = true (a pessoa pode falar com a equipa pelas Mensagens).
- Não inventes preços, prazos nem regras. Não peças palavras-passe nem dados de cartões.
Informação do Huambo Online:
${KNOWLEDGE}` },
        ...history,
        { role: "user", content: clip(body.question, 600) }
      ], obj({ answer: str, handoff: { type: "boolean" } }), { temperature: 0.2, max_tokens: 500 });
      if (!out) return reply({ answer: "", handoff: true, remaining });
      return reply({ answer: text(out.answer, 1500), handoff: !!out.handoff, remaining });
    }

    if (task === "staff_reply") {
      const conversationId = String(body.conversationId ?? ""), audience = String(body.audienceId ?? "");
      const { data: msgs, error } = await supabase.from("messages").select("sender_id,body,from_team,audience,created_at,attachment_kind")
        .eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(25);
      if (error) return reply({ error: "NOT_FOUND", remaining }, 404);
      const lines = (msgs ?? []).reverse()
        .filter(m => !m.from_team ? true : (m.audience === null || m.audience === audience))
        .map(m => m.from_team ? `EQUIPA → ${m.audience === audience ? "esta pessoa" : "as duas partes"}: ${clip(m.body, 400)}`
          : `${m.sender_id === audience ? "ESTA PESSOA" : "OUTRA PARTE"}: ${clip(m.body, 400)}${m.attachment_kind ? ` [${m.attachment_kind}]` : ""}`);
      const out = await chat(apiKey, [
        { role: "system", content: `És o assistente da equipa do Huambo Online. A equipa é intermediária: as pessoas não falam diretamente entre si; a equipa lê as mensagens e responde ou reencaminha.
Escreve um rascunho de resposta da equipa para "ESTA PESSOA", em português de Angola (ou na língua em que ela escreve), curto, educado e útil.
- Se a outra parte disse algo que deve chegar a esta pessoa, transmite-o (sem dados de contacto).
- Nunca partilhes telefones, moradas, WhatsApp ou e-mails. Não prometas reembolsos nem decisões.
- "note": uma frase só para a equipa, com algo a verificar (ou "").` },
        { role: "user", content: `Conversa${body.subject ? ` (assunto: ${clip(body.subject, 120)})` : ""}:\n${lines.join("\n") || "(sem mensagens)"}` }
      ], obj({ reply: str, note: str }), { temperature: 0.4, max_tokens: 500 });
      if (!out) return reply({ error: "AI_FAILED", remaining }, 502);
      return reply({ reply: stripContacts(text(out.reply, 1500)), note: text(out.note, 300), remaining });
    }

    if (task === "dispute_summary") {
      const id = String(body.disputeId ?? "");
      const { data: list, error } = await supabase.rpc("admin_list_disputes_v2", { p_status: null });
      const d = (list ?? []).find((x: any) => x.id === id);
      if (error || !d) return reply({ error: "NOT_FOUND", remaining }, 404);
      const events = (Array.isArray(d.events) ? d.events : []).slice(-20).map((e: any) => `${clip(e.created_at, 16)} · ${clip(e.actor_role, 20)} · ${clip(e.action, 30)}: ${clip(e.note, 300)}`).join("\n");
      const out = await chat(apiKey, [
        { role: "system", content: `Resumes uma disputa do Huambo Online para a equipa decidir. Em português de Angola, neutro, sem tomar partido nem decidir.
"summary": 3 a 5 frases (o que foi comprado, o que o comprador pede e porquê, o que o vendedor respondeu, em que ponto está).
"points": até 5 pontos a verificar antes de decidir (provas, prazos, valores). "missing": o que falta saber ("" se nada).` },
        { role: "user", content: `Encomenda ${clip(d.order_ref, 30)} · total ${d.order_total} Kz · pagamento ${clip(d.payment_method, 30)} · estado ${clip(d.order_status, 30)} · protegido: ${d.protected}
Comprador: ${clip(d.buyer_name, 60)} · Vendedor: ${clip(d.seller_name, 60)}
Pedido: ${clip(d.request, 30)} · Motivo: ${clip(d.reason, 60)} · Valor pedido: ${d.amount ?? "—"} Kz · Estado: ${clip(d.status, 30)}
Descrição do comprador: ${clip(d.description, 1500)}
Histórico:
${events || "(sem histórico)"}` }
      ], obj({ summary: str, points: { type: "array", items: str }, missing: str }), { temperature: 0.2, max_tokens: 600 });
      if (!out) return reply({ error: "AI_FAILED", remaining }, 502);
      return reply({ summary: text(out.summary, 1500), points: (out.points ?? []).slice(0, 5).map((p: unknown) => clip(p, 200)), missing: text(out.missing, 300), remaining });
    }
    return reply({ error: "INVALID_INPUT" }, 400);
  } catch (e) {
    console.error("ai-assist", task, String(e));
    return reply({ error: "AI_FAILED" }, 502);
  }
});
