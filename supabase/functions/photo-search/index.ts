// Pesquisa por fotografia: o Claude Haiku 5.5 olha para a fotografia e devolve palavras de
// pesquisa em português. Só para quem tem sessão iniciada, no máximo 20 por dia (contadas na
// base de dados). A fotografia não é guardada. A chave ANTHROPIC_API_KEY só existe aqui
// (segredo das Edge Functions do Supabase), nunca no Site nem na APP.
import Anthropic from "npm:@anthropic-ai/sdk@0.128.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = "claude-haiku-5-5";
const MAX_BASE64 = 2_000_000; // ~1,5 MB de imagem (a APP e o Site reduzem para 1024 px antes de enviar)
const TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type ImageType = (typeof TYPES)[number];
const LISTING_TYPES = ["product", "vehicle", "real_estate", "service", "classified", "none"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });

const SYSTEM = `És o assistente de pesquisa do Huambo Online, um site de classificados e loja do Huambo (Angola).
Recebes uma fotografia tirada por um comprador e dizes o que é o artigo principal, para o procurarmos.
- Responde em português de Angola, com palavras simples que um vendedor usaria num anúncio (ex.: "telemóvel", "botija de gás", "fuba", "Toyota Hilux").
- "label": o nome curto do artigo (2 a 5 palavras), com marca/modelo só se forem bem visíveis.
- "keywords": 1 a 5 palavras ou expressões curtas de pesquisa, da mais específica para a mais geral, sem repetir.
- "listing_type": product (objetos), vehicle (viaturas, motas), real_estate (casas, terrenos), service, classified (outros) ou none.
- Se a fotografia não mostrar nenhum artigo que se possa comprar, vender ou arrendar (ex.: só uma pessoa, um ecrã preto), põe "found" a false e "keywords" vazio.
- Não descrevas pessoas nem tentes identificá-las.`;

const SCHEMA = {
  type: "object",
  properties: {
    found: { type: "boolean" },
    label: { type: "string" },
    keywords: { type: "array", items: { type: "string" } },
    listing_type: { type: "string", enum: LISTING_TYPES }
  },
  required: ["found", "label", "keywords", "listing_type"],
  additionalProperties: false
};

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return reply({ error: "PHOTO_SEARCH_NOT_CONFIGURED" }, 503);

  // Quem está a pedir (sessão iniciada obrigatória).
  const auth = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false }
  });
  const { data: userData } = await supabase.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (!userData?.user) return reply({ error: "AUTH_REQUIRED" }, 401);

  let body: { image?: string; mediaType?: string };
  try { body = await req.json(); } catch { return reply({ error: "INVALID_IMAGE" }, 400); }
  const image = (body.image ?? "").replace(/^data:[^,]*,/, "");
  const mediaType = (body.mediaType ?? "image/jpeg") as ImageType;
  if (!image || image.length > MAX_BASE64 || !TYPES.includes(mediaType)) return reply({ error: "INVALID_IMAGE" }, 400);

  // Gasta uma das 20 pesquisas do dia (a base de dados recusa a 21.ª).
  const quota = await supabase.rpc("consume_photo_search");
  if (quota.error) {
    const limit = /PHOTO_SEARCH_LIMIT/.test(quota.error.message);
    return reply({ error: limit ? "PHOTO_SEARCH_LIMIT" : "AUTH_REQUIRED" }, limit ? 429 : 403);
  }
  const remaining = quota.data as number;

  const client = new Anthropic({ apiKey });
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
          { type: "text", text: "O que é o artigo desta fotografia? Dá as palavras de pesquisa." }
        ]
      }]
    });
    if (msg.stop_reason === "refusal") return reply({ found: false, label: "", keywords: [], listing_type: "none", remaining });
    const text = msg.content.find(b => b.type === "text");
    if (!text || text.type !== "text") return reply({ error: "PHOTO_SEARCH_FAILED", remaining }, 502);
    const out = JSON.parse(text.text) as { found: boolean; label: string; keywords: string[]; listing_type: string };
    const keywords = [...new Set((out.keywords ?? []).map(k => String(k).trim()).filter(Boolean))].slice(0, 5);
    return reply({ found: !!out.found && keywords.length > 0, label: String(out.label ?? "").slice(0, 80), keywords,
      listing_type: LISTING_TYPES.includes(out.listing_type) ? out.listing_type : "none", remaining });
  } catch (e) {
    console.error("photo-search", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : String(e));
    return reply({ error: "PHOTO_SEARCH_FAILED", remaining }, 502);
  }
});
