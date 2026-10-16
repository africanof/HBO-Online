"use client";
import { useEffect, useState } from "react";
import { requestBoost, boostStateFor, boostOfferText, boostRef, listBoostsForAdmin, decideBoost, paymentProofUrl, uploadPaymentProof, validateDocument,
  formatPrice, friendlyErrorIn, LANG_TAGS, PLAN_METHOD_LABELS, BOOST_STATUS_LABELS, type MyBoost, type AdminBoost, type BoostStatus, type PlatformSettings, type PaymentMethodPlan } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { PaymentDetails } from "./Plans";
import { useT, formatDateIn } from "../lib/i18n";

/** «⭐ Destacar» num anúncio publicado (Os meus anúncios). */
export function BoostBox({ listing, uid, boosts, settings, onDone }: { listing: { id: string; title: string; status: string }; uid: string; boosts: MyBoost[]; settings: PlatformSettings | null; onDone: (msg: string) => void }) {
  const { lang, t, tc } = useT();
  const [open, setOpen] = useState(false); const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express");
  const [reference, setReference] = useState(""); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const state = boostStateFor(listing.id, boosts);
  if (listing.status !== "published" && state.kind !== "active") return null;
  async function send() {
    if (!reference.trim() && !file) { setError(t("ls.boost_need_ref")); return; }
    if (file) { const bad = validateDocument({ size: file.size, type: file.type }); if (bad) { setError(tc(bad)); return; } }
    setBusy(true); setError("");
    try {
      let proof: string | null = null;
      if (file) { const up = await uploadPaymentProof(supabase(), uid, file, file.name, file.type); if (up.error || !up.data) throw up.error ?? new Error(t("ls.boost_proof_failed")); proof = up.data; }
      const r = await requestBoost(supabase(), listing.id, { method, reference, proofPath: proof });
      if (r.error) throw r.error;
      setOpen(false); onDone(t("ls.boost_sent"));
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <div className="stack" style={{ gap: 8 }}>
    {state.kind === "active" && <span className="ok">⭐ {t("ls.boost_until", { d: formatDateIn(state.until, lang) })}</span>}
    {state.kind === "pending" && <span>⏳ {t("ls.boost_pending")}</span>}
    {state.kind === "rejected" && <span className="error">{t("ls.boost_rejected")}{state.note ? ": " + state.note : ""}</span>}
    {listing.status === "published" && state.kind !== "pending" && (open ? <div className="card stack" style={{ gap: 10 }}>
      <strong>{tc(boostOfferText(settings))}{state.kind === "active" ? " — " + t("ls.boost_adds_days") : ""}</strong>
      <span>{t("ls.boost_explain")}</span>
      <strong>{t("ls.boost_step1")}</strong>
      <PaymentDetails s={settings} />
      <strong>{t("ls.boost_step2")}</strong>
      <div className="row" role="radiogroup" aria-label={t("ls.boost_how_paid")}>{(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(m => <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? "" : "secondary"} onClick={() => setMethod(m)}>{tc(PLAN_METHOD_LABELS[m])}</button>)}</div>
      <label>{t("ls.boost_ref")}<input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} placeholder={t("ls.boost_ref_ph")} /></label>
      <label>{t("ls.boost_proof")}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row"><button disabled={busy} onClick={send}>{busy ? t("ls.sending") : t("ls.boost_send")}</button><button className="secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</button></div>
    </div> : <button className="secondary" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>{state.kind === "active" ? "⭐ " + t("ls.boost_extend") : tc(boostOfferText(settings))}</button>)}
  </div>;
}

/** Administração: pedidos de destaque. */
export function AdminBoosts() {
  const { lang, t, tc } = useT();
  const [items, setItems] = useState<AdminBoost[]>([]); const [status, setStatus] = useState<BoostStatus | "">("pending");
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listBoostsForAdmin(supabase(), status); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void load(); }, [status]);
  async function decide(b: AdminBoost, ok: boolean) {
    const note = ok ? "" : prompt(t("ls.boost_why_not")) ?? "";
    if (!ok && !note.trim()) return;
    if (ok && !confirm(t("ls.boost_confirm_q", { amount: formatPrice(b.amount), name: b.owner_name, title: b.listing_title, days: b.days }))) return;
    const r = await decideBoost(supabase(), b.id, ok, note);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(ok ? t("ls.boost_active") : t("ls.request_declined")); await load(); }
  }
  async function proof(path: string) { const r = await paymentProofUrl(supabase(), path); if (r.data) window.open(r.data, "_blank", "noopener"); else setError(friendlyErrorIn(r.error, lang)); }
  return <section className="stack">
    <h2 style={{ margin: 0 }}>⭐ {t("ls.boost_admin_title")}</h2>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <label style={{ maxWidth: 260 }}>{t("ls.show")}<select value={status} onChange={e => setStatus(e.target.value as any)}>
      {(Object.keys(BOOST_STATUS_LABELS) as BoostStatus[]).map(k => <option key={k} value={k}>{tc(BOOST_STATUS_LABELS[k])}</option>)}<option value="">{t("ls.all")}</option></select></label>
    {items.length === 0 && <p>{t("ls.boost_none")}</p>}
    {items.map(b => <article key={b.id} className="card">
      <strong>{boostRef(b.ref_no)} · {formatPrice(b.amount)} · {t("ls.n_days", { n: b.days })} · <span className="badge">{tc(BOOST_STATUS_LABELS[b.status])}</span></strong>
      <span><a href={"/classificados/" + b.listing_id} target="_blank">{b.listing_title}</a> · {b.owner_name}{b.phone ? " · " + b.phone : ""}</span>
      <span>{b.method ? tc(PLAN_METHOD_LABELS[b.method]) : ""}{b.reference ? " · " + t("ls.ref_short") + " " + b.reference : ""} · {new Date(b.created_at).toLocaleString(LANG_TAGS[lang])}</span>
      {b.ends_at && <small>{t("ls.boost_until_short", { d: formatDateIn(b.ends_at, lang) })}</small>}
      {b.admin_note && <small>{t("ls.note")} {b.admin_note}</small>}
      <div className="row">
        {b.proof_path && <button className="secondary" onClick={() => proof(b.proof_path!)}>📄 {t("ls.proof")}</button>}
        {b.status === "pending" && <><button onClick={() => decide(b, true)}>✔ {t("ls.boost_confirm_btn")}</button><button className="danger" onClick={() => decide(b, false)}>✖ {t("ls.not_received")}</button></>}
      </div>
    </article>)}
  </section>;
}
