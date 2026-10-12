// Pagamento protegido: cria uma referência ProxyPay (Entidade + Referência + Montante) para o comprador
// pagar no Multicaixa Express, num ATM ou no banco. Só funciona quando a administração escolheu «ProxyPay»
// e o segredo PROXYPAY_API_KEY existe (segredo das Edge Functions; nunca no Site nem na APP).
// PROXYPAY_ENV = "production" para pagamentos reais (por omissão usa o ambiente de testes "sandbox").
import { createClient } from "jsr:@supabase/supabase-js@2";
import { proxypayBase, proxypayHeaders, referenceBody, referenceEnd, referenceId } from "../_shared/proxypay.ts";

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
  const apiKey = Deno.env.get("PROXYPAY_API_KEY");
  if (!apiKey) return reply({ error: "PROVIDER_NOT_CONFIGURED" }, 503);
  const auth = req.headers.get("Authorization");
  if (!auth) return reply({ error: "AUTH_REQUIRED" }, 401);
  let orderId = "";
  try { orderId = String((await req.json())?.order_id ?? ""); } catch { /* corpo inválido */ }
  if (!UUID.test(orderId)) return reply({ error: "ORDER_NOT_FOUND" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const settings = await asUser.from("platform_settings").select("payment_provider,proxypay_entity").eq("id", 1).maybeSingle();
  if (settings.data?.payment_provider !== "proxypay" || !settings.data?.proxypay_entity) return reply({ error: "PROVIDER_NOT_CONFIGURED" }, 503);

  // A base de dados confirma que a encomenda é desta pessoa e está à espera de pagamento.
  const quote = await asUser.rpc("order_payment_quote", { p_order_id: orderId });
  if (quote.error) return reply({ error: quote.error.message }, 400);
  const q = quote.data as { amount: number; ref: string; pay_by: string | null; existing: { entity: string; reference: string; amount: number; expires_at: string | null } | null };
  if (q.existing) return reply(q.existing);

  const base = proxypayBase(Deno.env.get("PROXYPAY_ENV"));
  const headers = proxypayHeaders(apiKey);
  const idRes = await fetch(`${base}/reference_ids`, { method: "POST", headers });
  const ref = referenceId(await idRes.text());
  if (!idRes.ok || !ref) return reply({ error: "PROVIDER_ERROR" }, 502);
  const end = referenceEnd(q.pay_by);
  const put = await fetch(`${base}/references/${ref}`, { method: "PUT", headers, body: JSON.stringify(referenceBody(q.amount, end, q.ref)) });
  if (!put.ok) return reply({ error: "PROVIDER_ERROR" }, 502);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const saved = await admin.rpc("provider_register_reference", { p_order_id: orderId, p_entity: settings.data.proxypay_entity, p_reference: ref,
    p_amount: q.amount, p_expires_at: end.toISOString() });
  if (saved.error) return reply({ error: saved.error.message }, 400);
  return reply({ entity: settings.data.proxypay_entity, reference: ref, amount: q.amount, expires_at: end.toISOString() });
});
