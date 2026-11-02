// Leitura de comprovativos de pagamento (talões de transferência e de Multicaixa Express) com
// OpenAI gpt-4o-mini. Chamada pelo servidor a cada 5 minutos (pg_cron) quando há comprovativos
// novos. A IA só LÊ o talão; a base de dados confere com regras fixas (ai_save_proof_check) e a
// equipa decide. Só trabalha sobre a fila, por isso pode ser chamada com a chave pública.
import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = "gpt-4o-mini";
const BUCKET = "payment-proofs";
const reply = (body: unknown, status = 200) => Response.json(body, { status });
const clip = (v: unknown, n: number) => (v == null ? null : String(v).replace(/\s+/g, " ").trim().slice(0, n) || null);
const IMAGE_TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

const SYSTEM = `Lês comprovativos de pagamento de Angola (talões e capturas de ecrã de transferências bancárias, Multicaixa Express, ATM e depósitos).
Extrai só o que está escrito; se um campo não aparece ou não se lê bem, devolve null. Não adivinhes.
- "readable": false se a imagem não for um comprovativo de pagamento ou não se conseguir ler.
- "amount": o valor transferido em kwanzas, só o número (ex.: 15000.00 → 15000).
- "date": data da operação no formato AAAA-MM-DD.
- "operation_id": n.º da operação / transação / referência / ID do movimento (o código único da operação).
- "destination": conta de destino como aparece (IBAN, n.º de conta ou n.º de telemóvel do Multicaixa Express).
- "beneficiary": nome do beneficiário (destinatário). "bank": banco ou aplicação (ex.: BAI, BFA, BIC, Multicaixa Express).
- "method": transferencia, multicaixa_express, deposito, atm ou outro.
- "visual_flags": SÓ sinais claros de edição ou montagem (ex.: valor com letra ou tamanho diferente do resto, números desalinhados ou borrados só nessa zona, partes coladas). Se não houver sinais claros, lista vazia.`;

const SCHEMA = {
  type: "object",
  properties: {
    readable: { type: "boolean" },
    amount: { type: ["number", "null"] },
    date: { type: ["string", "null"] },
    operation_id: { type: ["string", "null"] },
    destination: { type: ["string", "null"] },
    beneficiary: { type: ["string", "null"] },
    bank: { type: ["string", "null"] },
    method: { type: ["string", "null"] },
    visual_flags: { type: "array", items: { type: "string" } }
  },
  required: ["readable", "amount", "date", "operation_id", "destination", "beneficiary", "bank", "method", "visual_flags"],
  additionalProperties: false
};

function toBase64(bytes: Uint8Array): string {
  let s = ""; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}

Deno.serve(async req => {
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return reply({ error: "AI_NOT_CONFIGURED" }, 503);
  // O service_role deste projeto trabalha através de funções (e do armazenamento privado).
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const { data: queue, error } = await admin.rpc("ai_proof_queue", { p_limit: 8 });
  if (error) { console.error("ai-proof-check queue", error.message); return reply({ error: "QUEUE_FAILED" }, 500); }

  const results: Record<string, number> = {};
  for (const q of queue ?? []) {
    const save = (o: Record<string, unknown>) => admin.rpc("ai_save_proof_check", {
      p_kind: q.kind, p_payment_id: q.payment_id, p_proof_path: q.proof_path, p_readable: !!o.readable,
      p_amount: typeof o.amount === "number" && Number.isFinite(o.amount) ? o.amount : null,
      p_date: typeof o.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.date) ? o.date : null,
      p_operation: clip(o.operation_id, 60), p_destination: clip(o.destination, 60), p_beneficiary: clip(o.beneficiary, 120),
      p_bank: clip(o.bank, 60), p_method: clip(o.method, 40),
      p_visual_flags: Array.isArray(o.visual_flags) ? o.visual_flags.slice(0, 4).map(x => clip(x, 160)).filter(Boolean) : []
    });
    try {
      const ext = String(q.proof_path).split(".").pop()?.toLowerCase() ?? "";
      const mediaType = IMAGE_TYPES[ext];
      if (!mediaType) { await save({ readable: false }); results.unreadable = (results.unreadable ?? 0) + 1; continue; } // PDF ou outro: a equipa vê à mão
      const file = await admin.storage.from(BUCKET).download(q.proof_path);
      if (file.error || !file.data) { console.error("ai-proof-check download", q.proof_path, file.error?.message); continue; }
      const bytes = new Uint8Array(await file.data.arrayBuffer());
      if (bytes.length > 6_000_000) { await save({ readable: false }); continue; }
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL, temperature: 0, max_tokens: 400,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: [
              { type: "image_url", image_url: { url: `data:${mediaType};base64,${toBase64(bytes)}`, detail: "high" } },
              { type: "text", text: `Lê este comprovativo. (O cliente indicou: método ${q.method ?? "—"}, referência ${q.reference ?? "—"}.)` }
            ] }
          ],
          response_format: { type: "json_schema", json_schema: { name: "comprovativo", strict: true, schema: SCHEMA } }
        }),
        signal: AbortSignal.timeout(30_000)
      });
      if (!r.ok) { console.error("ai-proof-check openai", r.status, (await r.text()).slice(0, 200)); break; }
      const data = await r.json();
      const out = JSON.parse(data.choices?.[0]?.message?.content ?? "null") ?? { readable: false };
      const saved = await save(out);
      if (saved.error) { console.error("ai-proof-check save", saved.error.message); continue; }
      const v = String(saved.data); results[v] = (results[v] ?? 0) + 1;
    } catch (e) { console.error("ai-proof-check", String(e)); }
  }
  return reply({ checked: results });
});
