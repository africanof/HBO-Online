// WhatsApp da equipa: recebe as mensagens da Meta (webhook) e a IA responde primeiro.
// • GET: confirmação do webhook (hub.verify_token = WHATSAPP_VERIFY_TOKEN).
// • POST: mensagens e estados. Só aceita pedidos assinados pela Meta (WHATSAPP_APP_SECRET).
// A IA (OpenAI, a mesma informação da Ajuda) responde; passa à equipa quando o cliente pede uma pessoa,
// quando não sabe, quando chegam fotografias/áudios/documentos ou quando a conversa já está com a equipa.
// Esta função é pública (verify_jwt = false): quem chama é a Meta.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { KNOWLEDGE } from "../ai-assist/knowledge.ts";
import { markRead, sendText, verifySignature } from "../_shared/whatsapp.ts";

const MODEL = "gpt-4o-mini";
const AI_MAX_PER_DAY = 40;
const AREA_TEXT: Record<string, string> = {
  support: "atendimento geral (dúvidas, contas, pagamentos, encomendas, reclamações)",
  imports: "importação (compras no exterior): recolhe o que o cliente procura, a quantidade, fotografias ou ligações e o orçamento, e explica como pedir em «Importação» no Site ou na APP",
  inspections: "inspeção de artigos e entregas",
  sales: "vendas e anúncios",
  other: "atendimento"
};
const MEDIA_TEXT: Record<string, string> = { image: "a fotografia", audio: "o áudio", video: "o vídeo", document: "o documento", sticker: "o autocolante", location: "a localização" };

const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

/** Tira números de telefone e ligações das respostas da IA (os negócios fazem-se no Huambo Online). */
function stripContacts(s: string): string {
  return s.replace(/https?:\/\/(?!(www\.)?huamboonline\.com)\S+/gi, "").replace(/(\+?244[\s.-]?)?9\d{2}[\s.-]?\d{3}[\s.-]?\d{3}/g, "").replace(/[ \t]{2,}/g, " ").trim();
}

async function aiReply(info: any, text: string): Promise<{ answer: string; handoff: boolean } | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return null;
  const history = (Array.isArray(info.history) ? info.history : []).slice(0, -1)
    .filter((h: any) => h?.body).slice(-12)
    .map((h: any) => ({ role: h.author === "customer" ? "user" : "assistant", content: String(h.body).slice(0, 800) }));
  const system = `És o assistente do Huambo Online no WhatsApp (número «${info.label}», área: ${AREA_TEXT[info.area] ?? AREA_TEXT.other}).
O Huambo Online é o Site e a APP de classificados, loja, serviços e importação do Huambo, Angola (huamboonline.com).
- Responde na língua do cliente (normalmente português de Angola), curto (até 5 frases), simples e simpático. Sem markdown: só texto, podes usar *negrito* do WhatsApp.
- Usa só a informação abaixo e os dados da conta do cliente (se existirem). Não inventes preços, prazos nem regras.
- Põe "handoff" = true quando: o cliente pede uma pessoa/agente/equipa; é um problema concreto com pagamento, encomenda, reembolso, conta bloqueada ou reclamação; ou não sabes responder. Nesse caso diz que vais passar a conversa a uma pessoa da equipa, que responde aqui mesmo.
- Nunca dês telefones, e-mails ou dados de outras pessoas. Não peças palavras-passe, códigos nem dados de cartões.
- Para comprar, vender ou pagar, encaminha para o Site ou a APP (pagamento protegido).
${info.ai_instructions ? `Instruções da equipa para este número:\n${info.ai_instructions}\n` : ""}${info.context ? `Dados da conta deste cliente (só deste cliente):\n${info.context}\n` : "Este número de WhatsApp não está ligado a nenhuma conta do Huambo Online (pode pedir para registar o telefone no perfil).\n"}
Informação do Huambo Online:
${KNOWLEDGE}`;
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL, temperature: 0.3, max_tokens: 450,
        messages: [{ role: "system", content: system }, ...history, { role: "user", content: text.slice(0, 1500) }],
        response_format: { type: "json_schema", json_schema: { name: "resposta", strict: true, schema: {
          type: "object", properties: { answer: { type: "string" }, handoff: { type: "boolean" } }, required: ["answer", "handoff"], additionalProperties: false } } }
      }),
      signal: AbortSignal.timeout(25_000)
    });
    if (!r.ok) return null;
    const m = (await r.json()).choices?.[0]?.message;
    if (!m || m.refusal) return null;
    const out = JSON.parse(m.content ?? "null");
    return out ? { answer: stripContacts(String(out.answer ?? "")).slice(0, 1500), handoff: !!out.handoff } : null;
  } catch { return null; }
}

async function handleMessage(db: ReturnType<typeof admin>, token: string, phoneNumberId: string, m: any, contacts: any[]) {
  const waId = String(m?.from ?? "").replace(/\D/g, "");
  if (!waId || !m?.id) return;
  const type = String(m.type ?? "text");
  let body: string | null = null; let media: string | null = null;
  if (type === "text") body = String(m.text?.body ?? "");
  else if (type === "button") body = String(m.button?.text ?? "");
  else if (type === "interactive") body = String(m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "");
  else { media = type; body = m[type]?.caption ? String(m[type].caption) : null; }
  const name = contacts.find((c: any) => c?.wa_id === m.from)?.profile?.name ?? null;

  const r = await db.rpc("whatsapp_inbound", { p_phone_number_id: phoneNumberId, p_wa_id: waId, p_name: name, p_wa_message_id: String(m.id), p_body: body, p_media_type: media });
  const info = r.data as any;
  if (r.error || !info || info.ignored || info.duplicate) return;
  await markRead(token, phoneNumberId, String(m.id));

  const send = async (text: string, author: "ai" | "system") => {
    const s = await sendText(token, phoneNumberId, waId, text);
    await db.rpc("whatsapp_outbound", { p_thread: info.thread_id, p_author: author, p_body: text, p_wa_message_id: s.id ?? "", p_error: s.error });
  };
  const handover = (reason: string) => db.rpc("whatsapp_handover", { p_thread: info.thread_id, p_reason: reason });

  // Já está com a equipa: a IA não responde, só avisa a equipa.
  if (info.status === "human") { await handover(body ?? `📎 ${media}`); return; }
  if (!info.ai_enabled) { await handover(body ?? `📎 ${media}`); return; }
  if (media && !body) {
    await send(`Recebemos ${MEDIA_TEXT[media] ?? "o seu ficheiro"}. Uma pessoa da equipa do Huambo Online vai ver e responder-lhe aqui em breve. 🙏`, "system");
    await handover(`📎 ${media}`);
    return;
  }
  if (Number(info.ai_count_24h) >= AI_MAX_PER_DAY) {
    await send("Vou passar a nossa conversa a uma pessoa da equipa do Huambo Online, que lhe responde aqui em breve. 🙏", "system");
    await handover("limite de respostas automáticas");
    return;
  }
  const out = await aiReply(info, body ?? "");
  if (!out || !out.answer) {
    await send("Obrigado pela sua mensagem! Uma pessoa da equipa do Huambo Online vai responder-lhe aqui em breve. 🙏", "system");
    await handover(body ?? "");
    return;
  }
  await send(out.answer, "ai");
  if (out.handoff) await handover(body ?? "");
}

async function handle(payload: any, token: string) {
  const db = admin();
  for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const v = change?.value ?? {};
      const phoneNumberId = String(v?.metadata?.phone_number_id ?? "");
      if (!phoneNumberId) continue;
      for (const s of Array.isArray(v.statuses) ? v.statuses : []) {
        await db.rpc("whatsapp_status_update", { p_wa_message_id: String(s?.id ?? ""), p_status: String(s?.status ?? ""), p_error: s?.errors?.[0]?.title ?? null });
      }
      for (const m of Array.isArray(v.messages) ? v.messages : []) {
        try { await handleMessage(db, token, phoneNumberId, m, Array.isArray(v.contacts) ? v.contacts : []); }
        catch (e) { console.error("whatsapp message", (e as Error)?.message); }
      }
    }
  }
}

Deno.serve(async req => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const verify = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
    if (verify && url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === verify) {
      return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const secret = Deno.env.get("WHATSAPP_APP_SECRET"), token = Deno.env.get("WHATSAPP_TOKEN");
  if (!secret || !token) return new Response("not configured", { status: 503 });
  const raw = await req.text();
  if (!(await verifySignature(raw, req.headers.get("x-hub-signature-256"), secret))) return new Response("bad signature", { status: 401 });
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }
  // Responde já à Meta (senão repete o envio) e trata a mensagem a seguir.
  const work = handle(payload, token).catch(e => console.error("whatsapp", (e as Error)?.message));
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(work); else await work;
  return new Response("ok", { status: 200 });
});
