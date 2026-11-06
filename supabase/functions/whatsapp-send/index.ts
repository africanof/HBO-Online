// WhatsApp da equipa: uma pessoa da equipa responde a uma conversa a partir da administração do Huambo Online.
// Só membros da equipa; só dentro das 24 horas depois da última mensagem do cliente (regra da Meta).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendText } from "../_shared/whatsapp.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
  const token = Deno.env.get("WHATSAPP_TOKEN");
  if (!token) return reply({ error: "WHATSAPP_NOT_CONFIGURED" }, 503);
  const auth = req.headers.get("Authorization");
  if (!auth) return reply({ error: "AUTH_REQUIRED" }, 401);
  let body: any = {};
  try { body = await req.json(); } catch { return reply({ error: "INVALID_INPUT" }, 400); }
  const threadId = String(body?.thread_id ?? ""), text = String(body?.text ?? "").trim().slice(0, 4000);
  if (!UUID.test(threadId) || text.length < 1) return reply({ error: "INVALID_INPUT" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const p = await asUser.rpc("whatsapp_team_prepare", { p_thread: threadId });
  if (p.error) return reply({ error: /ADMIN_ONLY/.test(p.error.message) ? "ADMIN_ONLY" : /NOT_FOUND/.test(p.error.message) ? "NOT_FOUND" : "AUTH_REQUIRED" }, 403);
  const info = p.data as any;
  if (!info?.window_open) return reply({ error: "WHATSAPP_WINDOW_CLOSED" }, 409);

  const s = await sendText(token, info.phone_number_id, info.wa_id, text);
  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  await db.rpc("whatsapp_outbound", { p_thread: threadId, p_author: "team", p_body: text, p_wa_message_id: s.id ?? "", p_error: s.error, p_team_user: info.user_id });
  if (s.error) return reply({ error: "WHATSAPP_SEND_FAILED", detail: s.error }, 502);
  return reply({ ok: true, id: s.id });
});
