// Resumo diário por email (Resend). Chamada pelo servidor ao fim do dia (pg_cron).
// Para cada pessoa com notificações por ler (email_digest_queue) envia UM email com as últimas (até 10)
// e marca-as como enviadas (email_digest_mark). Cada email traz a ligação para cancelar.
// Nunca passa do plano grátis do Resend: no máximo 90 emails por dia e 2 700 por mês (email_quota_take).
// Precisa do segredo RESEND_API_KEY. Remetente: avisos@huamboonline.com (domínio verificado no Resend);
// pode ser trocado com o segredo EMAIL_FROM. SITE_URL é opcional. Sem a chave não envia nada. Só trabalha sobre a fila, por isso pode ser chamada
// com a chave pública sem custos extra.
import { createClient } from "jsr:@supabase/supabase-js@2";

const reply = (body: unknown, status = 200) => Response.json(body, { status });
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

type Item = { id: string; title: string; body: string; data: Record<string, unknown> | null; created_at: string };

/** Ligação de cada aviso: o anúncio, a conversa ou a lista de notificações. */
function linkFor(site: string, n: Item): string {
  const d = n.data ?? {};
  if (isUuid(d.conversation_id)) return `${site}/mensagens?conversation=${d.conversation_id}`;
  const ids = Array.isArray(d.listing_ids) ? d.listing_ids.filter(isUuid) : [];
  if (ids.length > 1) return `${site}/notificacoes/digest?ids=${ids.join(",")}`;
  if (isUuid(d.listing_id)) return `${site}/classificados/${d.listing_id}`;
  if (ids.length === 1) return `${site}/classificados/${ids[0]}`;
  return `${site}/notificacoes`;
}

export function renderDigest(site: string, name: string | null, items: Item[], total: number, unsubscribeUrl: string) {
  const first = (name ?? "").trim().split(/\s+/)[0];
  const hello = first ? `Olá, ${esc(first)}!` : "Olá!";
  const intro = total === 1 ? "Tem 1 aviso por ler no Huambo Online:" : `Tem ${total} avisos por ler no Huambo Online:`;
  const rows = items.map(n => `<tr><td style="padding:12px 0;border-bottom:1px solid #e5e7eb">
    <a href="${esc(linkFor(site, n))}" style="color:#0b3d91;font-weight:700;text-decoration:none;font-size:16px">${esc(n.title)}</a>
    <div style="color:#374151;font-size:15px;margin-top:4px">${esc(n.body)}</div></td></tr>`).join("");
  const more = total > items.length ? `<p style="color:#374151">… e mais ${total - items.length}.</p>` : "";
  const html = `<!doctype html><html lang="pt"><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;padding:24px" cellpadding="0" cellspacing="0"><tr><td>
<h1 style="margin:0 0 4px;font-size:22px;color:#0b3d91">Huambo Online</h1>
<p style="font-size:17px;color:#111827;margin:16px 0 4px">${hello}</p>
<p style="font-size:16px;color:#111827;margin:0 0 8px">${intro}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>${more}
<p style="margin:24px 0"><a href="${esc(site)}/notificacoes" style="background:#0b3d91;color:#ffffff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">Ver todas as notificações</a></p>
<p style="font-size:13px;color:#6b7280">Recebe este resumo porque tem conta no Huambo Online. Pode desligá-lo em «Preferências de notificações» ou
<a href="${esc(unsubscribeUrl)}" style="color:#6b7280">cancelar estes emails com um toque</a>.</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = [hello, intro, "", ...items.map(n => `• ${n.title} — ${n.body}\n  ${linkFor(site, n)}`), total > items.length ? `… e mais ${total - items.length}.` : "",
    "", `Ver todas: ${site}/notificacoes`, `Cancelar estes emails: ${unsubscribeUrl}`].join("\n");
  const subject = total === 1 ? `🔔 ${items[0]?.title ?? "Tem 1 aviso"}` : `🔔 Tem ${total} avisos no Huambo Online`;
  return { subject, html, text };
}

Deno.serve(async req => {
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM") || "Huambo Online <avisos@huamboonline.com>";
  if (!apiKey) return reply({ error: "EMAIL_NOT_CONFIGURED" }, 503);
  const site = (Deno.env.get("SITE_URL") || "https://huamboonline.com").replace(/\/+$/, "");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: queue, error } = await admin.rpc("email_digest_queue", { p_limit: 90 });
  if (error) { console.error("email-digest queue", error.message); return reply({ error: "QUEUE_FAILED" }, 500); }

  let sent = 0, failed = 0, limited = false;
  const started = Date.now();
  for (const row of queue ?? []) {
    if (Date.now() - started > 100_000) break;
    const items = (row.notifications ?? []) as Item[];
    if (!items.length || !row.email) continue;
    const unsub = `${site}/email/cancelar?t=${row.unsubscribe_token}`;
    const oneClick = `${site}/email/cancelar/um-clique?t=${row.unsubscribe_token}`;
    const m = renderDigest(site, row.full_name, items, row.total ?? items.length, unsub);
    // Nunca passar do plano grátis do Resend: a base de dados conta e recusa acima de 90/dia e 2 700/mês.
    const quota = await admin.rpc("email_quota_take");
    if (quota.error || quota.data !== true) { limited = true; break; }
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [row.email], subject: m.subject, html: m.html, text: m.text,
          headers: { "List-Unsubscribe": `<${oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }),
        signal: AbortSignal.timeout(15_000)
      });
      if (r.status === 429) { await admin.rpc("email_quota_release"); limited = true; console.error("email-digest: limite do Resend atingido"); break; }
      if (!r.ok) { await admin.rpc("email_quota_release"); failed++; console.error("email-digest resend", r.status, (await r.text()).slice(0, 200)); continue; }
      await admin.rpc("email_digest_mark", { p_user: row.user_id });
      sent++;
    } catch (e) { await admin.rpc("email_quota_release"); failed++; console.error("email-digest", String(e)); }
  }
  return reply({ users: queue?.length ?? 0, sent, failed, limit_reached: limited });
});
