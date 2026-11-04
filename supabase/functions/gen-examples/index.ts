// Gera (uma única vez) as fotografias ilustrativas dos exemplos com IA (OpenAI gpt-image-2; outro modelo com o segredo IMAGE_MODEL) e guarda-as em
// classified-media/exemplos/<slug>.jpg. Só aceita os 18 nomes fixos abaixo e nunca gera uma imagem que já exista,
// por isso o custo máximo é o destas 18 imagens. Pessoas com tom de pele negro (Huambo, Angola), sem marcas nem texto.
// Uso: POST { "slug": "hilux" } → { url }. Depois de usada pode ser apagada.
import { createClient } from "jsr:@supabase/supabase-js@2";

const STYLE = "Realistic photograph, natural light, Huambo, Angola (central highlands). No text, no logos, no brand names, no watermarks, no licence plates.";
const PROMPTS: Record<string, string> = {
  telemovel: "A mid-range Android smartphone with the screen on, lying on a wooden table, product photo.",
  frigorifico: "A modern silver two-door fridge-freezer in a simple Angolan home kitchen.",
  vivenda: "A single-storey three-bedroom house with a walled yard and a metal gate in a residential neighbourhood of Huambo, red soil, blue sky, jacaranda tree.",
  apartamento: "A bright furnished two-bedroom apartment living room with a sofa, a small dining table and a window, simple modern Angolan style.",
  hilux: "A white double-cab pickup truck parked on a red dirt road in the green Angolan highlands, three-quarter view.",
  motorizada: "A red 125cc motorcycle parked on a street in a small Angolan town, side view.",
  vaga: "A smiling young Black woman working as a cashier at a supermarket checkout in Angola, wearing a uniform.",
  estagio: "A young Black man intern at an office desk reviewing accounting documents on a laptop, Angola.",
  batata: "Open sacks full of fresh potatoes at an outdoor market in the Angolan highlands.",
  milho: "Heaps and sacks of dried yellow maize grains at a rural market in Angola.",
  arroz: "A plain 25 kg sack of long-grain rice on a shop shelf, no printed brand.",
  panela: "A 7-litre aluminium pressure cooker on a kitchen counter, product photo.",
  eletricista: "A Black male electrician wearing safety gloves installing wiring in a household electrical panel.",
  explicadora: "A Black woman tutor teaching mathematics to two Black teenage students at a table with notebooks.",
  restaurante: "A plate of Angolan funje with chicken muamba and greens served on a restaurant table.",
  hotel: "A clean, bright hotel room with a double bed, white sheets and a window with curtains.",
  concerto: "A lively live music concert at night with a crowd of Black people dancing in front of a stage with lights.",
  feira: "A busy farmers' market in Angola with Black women vendors selling vegetables, potatoes and maize."
};

const reply = (b: unknown, status = 200) => Response.json(b, { status });

Deno.serve(async req => {
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
  const { slug } = await req.json().catch(() => ({}));
  if (typeof slug !== "string" || !PROMPTS[slug]) return reply({ error: "UNKNOWN_SLUG" }, 400);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const path = `exemplos/${slug}.jpg`;
  const pub = admin.storage.from("classified-media").getPublicUrl(path).data.publicUrl;
  const have = await admin.storage.from("classified-media").list("exemplos", { search: `${slug}.jpg` });
  if ((have.data ?? []).some(f => f.name === `${slug}.jpg`)) return reply({ url: pub, existed: true });
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return reply({ error: "AI_NOT_CONFIGURED" }, 503);
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: Deno.env.get("IMAGE_MODEL") || "gpt-image-2", prompt: `${PROMPTS[slug]} ${STYLE}`, size: "1024x1024", quality: "medium",
      output_format: "jpeg", output_compression: 82, n: 1 }),
    signal: AbortSignal.timeout(140_000)
  });
  if (!r.ok) return reply({ error: "AI_FAILED", status: r.status, detail: (await r.text()).slice(0, 300) }, 502);
  const b64 = (await r.json())?.data?.[0]?.b64_json;
  if (!b64) return reply({ error: "AI_EMPTY" }, 502);
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const up = await admin.storage.from("classified-media").upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (up.error) return reply({ error: "UPLOAD_FAILED", detail: up.error.message }, 500);
  return reply({ url: pub, existed: false });
});
