"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { listMyServiceRequests, updateServiceRequest, confirmService, serviceActions, validateReview, friendlyErrorIn, sendServiceQuote, acceptServiceQuote, formatPrice, orderHref,
  SERVICE_STATUS_LABELS, SERVICE_ACTION_LABELS, formatPreferredDate, LANG_TAGS, type ServiceRequest, type ServiceAction } from "@huambo-online/core";
import { currentUserId, supabase } from "../../lib/supabase";
import { useT } from "../../lib/i18n";
import { StarPicker } from "../../components/Reputation";

function ConfirmBox({ id, onDone }: { id: string; onDone: (msg: string, err?: boolean) => void }) {
  const { lang, t, tc } = useT();
  const [rating, setRating] = useState(0); const [comment, setComment] = useState(""); const [busy, setBusy] = useState(false);
  async function send() {
    const v = validateReview(rating, comment); if (v) { onDone(tc(v), true); return; }
    setBusy(true); const r = await confirmService(supabase(), id, rating, comment); setBusy(false);
    if (r.error) onDone(friendlyErrorIn(r.error, lang), true); else onDone(t("sv.sr_confirmed"));
  }
  return <div className="card" style={{ background: "var(--surface)" }}>
    <strong>{t("sv.sr_done_q")}</strong>
    <StarPicker value={rating} onChange={setRating} />
    <textarea rows={2} value={comment} onChange={e => setComment(e.target.value)} placeholder={t("sv.sr_comment_ph")} />
    <button disabled={busy || !rating} onClick={send}>{busy ? t("sv.sending") : "✔ " + t("sv.sr_confirm_btn")}</button>
  </div>;
}

function Servicos() {
  const { lang, t, tc } = useT();
  const params = useSearchParams();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [as, setAs] = useState<"client" | "provider">(params.get("recebidos") ? "provider" : "client");
  const [items, setItems] = useState<ServiceRequest[] | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState("");
  async function load(a = as) { setItems(null); const r = await listMyServiceRequests(supabase(), a); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []);
  useEffect(() => { if (uid) void load(as); }, [as]);
  async function quote(id: string) {
    const v = prompt(t("sv.quote_amount_q")); if (v == null) return;
    const amount = Number(v.replace(/\s/g, "").replace(",", "."));
    if (!(amount > 0)) { setError(t("sv.quote_amount_bad")); return; }
    const note = prompt(t("sv.quote_note_q")) ?? undefined;
    setError(""); setNotice("");
    const r = await sendServiceQuote(supabase(), id, amount, note);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("sv.quote_sent")); await load(); }
  }
  async function pay(id: string) {
    setError(""); setNotice("");
    const r = await acceptServiceQuote(supabase(), id);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else window.location.href = orderHref(String(r.data), true);
  }
  async function act(id: string, action: ServiceAction) {
    if (action === "decline" || action === "cancel") { if (!confirm(action === "decline" ? t("sv.sr_decline_q") : t("sv.sr_cancel_q"))) return; }
    const note = action === "accept" || action === "done" || action === "decline" ? prompt(t("sv.sr_note_q")) ?? undefined : undefined;
    setError(""); setNotice("");
    const r = await updateServiceRequest(supabase(), id, action, note);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("sv.sr_updated")); await load(); }
  }
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main><a href="/">← Huambo Online</a><h1>{t("sv.sr_title")}</h1><p><a href="/conta/login?voltar=/servicos">{t("sv.login_link")}</a>.</p></main>;
  return <main className="stack">
    <a href="/conta">← {t("sv.your_account")}</a>
    <h1>🛠️ {t("sv.sr_title")}</h1>
    <div className="row" role="tablist">
      <button role="tab" aria-selected={as === "client"} className={as === "client" ? "" : "secondary"} onClick={() => setAs("client")}>{t("sv.sr_asked")}</button>
      <button role="tab" aria-selected={as === "provider"} className={as === "provider" ? "" : "secondary"} onClick={() => setAs("provider")}>{t("sv.sr_received")}</button>
    </div>
    {as === "client" && <p>{t("sv.sr_hint_a")} <a href="/profissionais">{t("sv.sr_hint_pros")}</a> {t("sv.sr_hint_and")} <a href="/empresas">{t("sv.sr_hint_biz")}</a>. {t("sv.sr_hint_b")}</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items === null && !error && <p>{t("common.loading")}</p>}
    {items?.length === 0 && <p>{t("sv.sr_none")}</p>}
    {items?.map(s => <article key={s.id} className="card">
      <strong style={{ fontSize: 19 }}>{as === "client" ? <a href={s.provider_id ? "/profissionais/" + s.provider_id : "/empresas/" + s.business_id}>{s.target_name}</a> : s.client_name} · <span className="badge">{tc(SERVICE_STATUS_LABELS[s.status])}</span></strong>
      <span style={{ whiteSpace: "pre-wrap" }}>{s.description}</span>
      {s.preferred_date && <span>📅 {tc(formatPreferredDate(s.preferred_date))}</span>}
      {s.provider_note && <span>💬 {s.provider_note}</span>}
      {s.quote_amount != null && <span>🧾 {t("sv.quote")}: <strong>{formatPrice(s.quote_amount)}</strong>{s.quote_note ? " · " + s.quote_note : ""}{s.escrow_status === "held" ? " · 🛡️ " + t("sv.quote_paid") : s.escrow_status === "released" ? " · ✅ " + t("sv.quote_released") : ""}</span>}
      {s.order_id && <a href={orderHref(s.order_id)}>🛡️ {t("pp.see_order")}</a>}
      <small>{new Date(s.created_at).toLocaleString(LANG_TAGS[lang])}</small>
      <div className="row">{serviceActions(s.status, as, { quoted: s.quote_amount != null, escrow: s.escrow_status }).map(a => a === "confirm"
        ? <button key={a} onClick={() => setConfirming(confirming === s.id ? "" : s.id)}>{tc(SERVICE_ACTION_LABELS.confirm)}</button>
        : a === "quote" ? <button key={a} onClick={() => quote(s.id)}>{tc(SERVICE_ACTION_LABELS.quote)}</button>
        : a === "pay" ? <button key={a} onClick={() => pay(s.id)}>{tc(SERVICE_ACTION_LABELS.pay)}</button>
        : <button key={a} className={a === "decline" || a === "cancel" ? "danger" : a === "accept" ? "" : "secondary"} onClick={() => act(s.id, a)}>{tc(SERVICE_ACTION_LABELS[a])}</button>)}</div>
      {confirming === s.id && <ConfirmBox id={s.id} onDone={(msg, err) => { if (err) setError(msg); else { setConfirming(""); setNotice(msg); void load(); } }} />}
    </article>)}
  </main>;
}
function Loading() { const { t } = useT(); return <main><p>{t("common.loading")}</p></main>; }
export default function Page() { return <Suspense fallback={<Loading />}><Servicos /></Suspense>; }
