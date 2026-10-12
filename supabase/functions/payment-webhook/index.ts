// Pagamento protegido: aviso automático da ProxyPay quando um cliente paga uma referência.
// O aviso tem de vir assinado com a chave da API (cabeçalho X-Signature); avisos repetidos só contam uma vez.
// Depois de registado, o pagamento é marcado como tratado na ProxyPay (DELETE /payments/{id}).
// Sem o segredo PROXYPAY_API_KEY não faz nada. Esta função é pública (verify_jwt = false): quem chama é a ProxyPay.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { parsePaymentEvent, proxypayBase, proxypayHeaders, verifySignature } from "../_shared/proxypay.ts";

Deno.serve(async req => {
  if (req.method !== "POST") return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });
  const apiKey = Deno.env.get("PROXYPAY_API_KEY");
  if (!apiKey) return Response.json({ error: "PROVIDER_NOT_CONFIGURED" }, { status: 503 });
  const raw = await req.text();
  if (!(await verifySignature(raw, req.headers.get("X-Signature"), apiKey))) return Response.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
  let event = null;
  try { event = parsePaymentEvent(JSON.parse(raw)); } catch { /* corpo inválido */ }
  if (!event) return Response.json({ error: "INVALID_EVENT" }, { status: 400 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const r = await admin.rpc("provider_confirm_payment", { p_reference: event.reference, p_amount: event.amount, p_provider_payment_id: event.id });
  if (r.error) return Response.json({ error: "DATABASE_ERROR" }, { status: 500 }); // a ProxyPay volta a tentar
  // Registado (ou já registado): diz à ProxyPay que está tratado.
  await fetch(`${proxypayBase(Deno.env.get("PROXYPAY_ENV"))}/payments/${encodeURIComponent(event.id)}`, { method: "DELETE", headers: proxypayHeaders(apiKey) }).catch(() => null);
  return Response.json({ ok: true, result: r.data });
});
