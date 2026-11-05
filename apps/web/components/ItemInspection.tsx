"use client";
import { useEffect, useState } from "react";
import { itemInspectionBadge, requestItemInspection, getItemInspectionFees, myItemInspections, submitItemInspectionPayment, cancelItemInspection, myListingOrder,
  listItemInspectionsForAdmin, decideItemInspectionPayment, itemInspectionStep, setItemInspectionFees, itemInspectionAdminSteps, itemInspectionRef, itemInspectionCategory,
  getPlatformSettings, uploadPaymentProof, paymentProofUrl, validateDocument, sha256Hex, formatPrice, friendlyErrorIn, ITEM_INSPECTION_CHECKLIST, ITEM_INSPECTION_OPEN, PLAN_METHOD_LABELS,
  type ItemInspection, type ItemInspectionBadge, type ItemInspectionCategory, type ItemInspectionFees, type ItemInspectionStep, type PlatformSettings } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { useT, eventDateIn, formatDateIn } from "../lib/i18n";
import { PaymentDetails } from "./Plans";

/** Lista de pontos verificados (✔ / ✖). */
function Checklist({ category, checklist }: { category: ItemInspectionCategory; checklist: Record<string, boolean> }) {
  const { t } = useT();
  const keys = ITEM_INSPECTION_CHECKLIST[category].filter(k => k in checklist);
  if (!keys.length) return null;
  return <ul style={{ margin: 0, paddingLeft: 18 }}>{keys.map(k => <li key={k}>{checklist[k] ? "✔" : "✖"} {t("ii.c." + k)}</li>)}</ul>;
}

/** No anúncio: selo para todos; pedido de inspeção para o dono (antes de vender) ou para quem já comprou. */
export function ListingInspection({ listingId, listingType, mine, uid }: { listingId: string; listingType: string; mine: boolean; uid: string | null }) {
  const { t, lang } = useT();
  const category = itemInspectionCategory(listingType);
  const [badge, setBadge] = useState<ItemInspectionBadge | null>(null); const [fees, setFees] = useState<ItemInspectionFees | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null); const [open, setOpen] = useState<ItemInspection | null>(null);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  useEffect(() => {
    void itemInspectionBadge(supabase(), { listingId }).then(setBadge);
    void getItemInspectionFees(supabase()).then(setFees);
    if (!uid) return;
    void myItemInspections(supabase()).then(r => setOpen(r.data.find(i => i.listing_id === listingId && i.requester_id === uid && ITEM_INSPECTION_OPEN.includes(i.status)) ?? null));
    if (!mine) void myListingOrder(supabase(), listingId).then(o => setOrderId(o?.id ?? null));
  }, [listingId, uid, mine]);
  async function ask() {
    setBusy(true); setErr("");
    const r = await requestItemInspection(supabase(), mine || !orderId ? { listingId } : { orderId }); // sem encomenda: inspeção antes de comprar
    setBusy(false);
    if (r.error) setErr(friendlyErrorIn(r.error, lang)); else { setMsg(t("ii.requested")); setOpen(r.data as any); }
  }
  const fee = fees ? formatPrice(fees[category]) : "";
  const canAsk = uid && !open && (mine ? !badge : !!orderId);
  const visitor = !mine && !orderId && !open && !msg;
  return <section className="card stack" style={{ gap: 8 }}>
    {badge ? <>
      <strong className="verified" style={{ justifySelf: "start", fontSize: 16 }}>{t("ii.badge")}</strong>
      <small>{t("ii.badge_when", { d: formatDateIn(badge.inspected_at, lang), v: formatDateIn(badge.valid_until, lang) })} · {itemInspectionRef(badge.ref_no)}</small>
      <details><summary style={{ cursor: "pointer", fontWeight: 700 }}>{t("ii.report")}</summary>
        <Checklist category={badge.category} checklist={badge.checklist} />
        {badge.report && <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{badge.report}</p>}
      </details>
    </> : <strong>{t("ii.title")}</strong>}
    {canAsk && <>
      <span>{t(mine ? "ii.seller_offer" : "ii.buyer_offer", { fee })}</span>
      <small className="muted">{t("ii.how." + category)}</small>
      <button type="button" className="secondary" disabled={busy} style={{ justifySelf: "start" }} onClick={() => void ask()}>{t("ii.request", { fee })}</button>
    </>}
    {visitor && <><span>{t("ii.visitor_offer", { fee })}</span><small className="muted">{t("ii.how." + category)}</small>
      {uid ? <button type="button" className="secondary" disabled={busy} style={{ justifySelf: "start" }} onClick={() => void ask()}>{t("ii.request_prebuy", { fee })}</button>
        : <a href={"/conta/login?voltar=/classificados/" + listingId}>{t("ii.prebuy_login")}</a>}</>}
    {(open || msg) && <span>{msg || t("ii.s." + open!.status)} · <a href="/inspecoes">{t("ii.see_mine")} →</a></span>}
    {err && <p className="error" role="alert" style={{ margin: 0 }}>{err}</p>}
  </section>;
}

/** Transferência para o Huambo Online + comprovativo. */
function FeePayBox({ i, onDone }: { i: ItemInspection; onDone: () => void }) {
  const { t, tc, lang } = useT();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [method, setMethod] = useState<"multicaixa_express" | "bank_transfer">("bank_transfer"); const [reference, setReference] = useState(""); const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { void getPlatformSettings(supabase()).then(x => setSettings(x.data)); }, []);
  async function pay() {
    if (!file || reference.replace(/[^A-Za-z0-9]/g, "").length < 4) { setErr(t("im.err_proof")); return; }
    const bad = validateDocument({ size: file.size, type: file.type }); if (bad) { setErr(tc(bad)); return; }
    setBusy(true); setErr("");
    try {
      const uid = await currentUserId(); if (!uid) throw new Error(t("sv.login_needed"));
      const hash = sha256Hex(await file.arrayBuffer());
      const up = await uploadPaymentProof(supabase(), uid, file, file.name, file.type); if (up.error || !up.data) throw up.error ?? new Error(t("sv.proof_fail"));
      const r = await submitItemInspectionPayment(supabase(), i.id, { method, reference, proofPath: up.data, proofHash: hash }); if (r.error) throw r.error;
      onDone();
    } catch (e) { setErr(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <div className="stack" style={{ gap: 8 }}>
    <strong>{t("ii.pay_step", { fee: formatPrice(i.fee) })}</strong>
    <PaymentDetails s={settings} />
    <p className="banner yellow" style={{ margin: 0, padding: 12, display: "block" }}>✍️ {t("ii.pay_desc", { ref: itemInspectionRef(i.ref_no) })}</p>
    <strong>{t("im.send_proof")}</strong>
    <div className="row" role="radiogroup">{(["multicaixa_express", "bank_transfer"] as const).map(m => <button key={m} type="button" role="radio" aria-checked={method === m}
      className={method === m ? "" : "secondary"} onClick={() => setMethod(m)}>{tc(PLAN_METHOD_LABELS[m])}</button>)}</div>
    <label>{t("sv.ref_label")}<input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} /></label>
    <label>{t("sv.fu_proof_required")}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
    {err && <p className="error" role="alert">{err}</p>}
    <button type="button" disabled={busy} style={{ justifySelf: "start" }} onClick={() => void pay()}>{busy ? t("sv.sending") : "✅ " + t("sv.fu_paid_send")}</button>
    <small>{t("ii.fee_note")}</small>
  </div>;
}

/** Página «As minhas inspeções». */
export function MyItemInspectionsPage() {
  const { t, lang } = useT();
  const [items, setItems] = useState<ItemInspection[] | null>(null); const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  async function load() { const r = await myItemInspections(supabase()); if (r.error) setErr(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }); }, []);
  if (uid === null) return <main><h1>{t("ii.see_mine")}</h1><a className="btn" href="/conta/login?voltar=/inspecoes">{t("auth.login")}</a></main>;
  return <main className="stack" style={{ maxWidth: 820 }}>
    <h1 style={{ margin: 0 }}>🔍 {t("ii.see_mine")}</h1>
    {msg && <p className="ok" role="status">{msg}</p>}
    {err && <p className="error" role="alert">{err}</p>}
    {items && !items.length && <p className="card">{t("ii.none")}</p>}
    {items?.map(i => <article key={i.id} className="card stack" style={{ gap: 8 }}>
      <strong style={{ fontSize: 18 }}>{i.title}</strong>
      <small>{itemInspectionRef(i.ref_no)} · {t("ii.cat." + i.category)} · {t(i.role === "seller" && i.mode === "buyer" ? "ii.mode.seller_of" : i.role === "seller" && i.mode === "prebuy" ? "ii.mode.seller_of_prebuy" : "ii.mode." + i.mode)} · {formatPrice(i.fee)}</small>
      <span style={{ fontWeight: 800 }}>{t("ii.s." + i.status)}</span>
      {i.scheduled_for && ["scheduled", "in_progress"].includes(i.status) && <span>{t("ii.when", { d: eventDateIn(i.scheduled_for, lang) })}{i.place ? " · 📍 " + i.place : ""}</span>}
      {i.team_note && <small>{t("im.team_note")}: {i.team_note}</small>}
      {i.report && <details open><summary style={{ cursor: "pointer", fontWeight: 700 }}>{t("ii.report")}</summary><Checklist category={i.category} checklist={i.checklist} /><p style={{ whiteSpace: "pre-wrap", margin: "6px 0 0" }}>{i.report}</p></details>}
      {i.listing_id && <a href={"/classificados/" + i.listing_id}>{t("cg.view_listing")} →</a>}
      {i.role === "requester" && i.status === "awaiting_payment" && <><small className="muted">{t("ii.how." + i.category)}</small><FeePayBox i={i} onDone={() => { setMsg(t("ii.proof_sent")); void load(); }} /></>}
      {i.role === "requester" && ["awaiting_payment", "payment_submitted"].includes(i.status) && <button type="button" className="secondary" style={{ justifySelf: "start" }}
        onClick={async () => { if (!confirm(t("ii.cancel") + "?")) return; const r = await cancelItemInspection(supabase(), i.id); if (r.error) setErr(friendlyErrorIn(r.error, lang)); else void load(); }}>{t("ii.cancel")}</button>}
    </article>)}
  </main>;
}

/** Equipa: taxas e pedidos de inspeção. */
export function AdminItemInspections() {
  const { t, lang } = useT();
  const [open, setOpen] = useState(true); const [items, setItems] = useState<ItemInspection[]>([]); const [err, setErr] = useState(""); const [msg, setMsg] = useState("");
  async function load() { const r = await listItemInspectionsForAdmin(supabase(), open); if (r.error) setErr(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void load(); }, [open]);
  async function run(fn: () => PromiseLike<{ error: any }>) { setErr(""); setMsg(""); const r = await fn(); if (r.error) setErr(friendlyErrorIn(r.error, lang)); else { setMsg(t("pp.decided")); void load(); } }
  return <section className="stack" style={{ gap: 10 }}>
    <h2 style={{ margin: 0 }}>{t("ii.a_title")}</h2>
    <InspectionFees />
    <div className="row">{[true, false].map(v => <button key={String(v)} type="button" className={open === v ? "" : "secondary"} onClick={() => setOpen(v)}>{t(v ? "im.a_open" : "im.a_all")}</button>)}</div>
    {err && <p className="error" role="alert">{err}</p>}
    {msg && <p className="ok" role="status">{msg}</p>}
    {!items.length && <p className="muted">{t("pp.none_pending")}</p>}
    {items.map(i => <AdminInspectionCard key={i.id} i={i} run={run} />)}
  </section>;
}

function InspectionFees() {
  const { t, lang } = useT();
  const [f, setF] = useState<ItemInspectionFees | null>(null); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  useEffect(() => { void getItemInspectionFees(supabase()).then(setF); }, []);
  if (!f) return null;
  return <details className="card"><summary style={{ cursor: "pointer", fontWeight: 800 }}>{t("ii.a_fees")}</summary>
    <div className="row" style={{ marginTop: 8 }}>{(["item", "vehicle", "property"] as const).map(k => <label key={k} style={{ flex: 1, minWidth: 140 }}>{t("ii.cat." + k)}
      <input value={String(f[k])} inputMode="numeric" onChange={e => setF({ ...f, [k]: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></label>)}</div>
    {err && <p className="error">{err}</p>}{msg && <p className="ok">{msg}</p>}
    <button type="button" onClick={async () => { setErr(""); setMsg(""); const r = await setItemInspectionFees(supabase(), f); if (r.error) setErr(friendlyErrorIn(r.error, lang)); else setMsg(t("pp.decided")); }}>{t("im.a_save")}</button>
  </details>;
}

function AdminInspectionCard({ i, run }: { i: ItemInspection; run: (fn: () => PromiseLike<{ error: any }>) => Promise<void> }) {
  const { t, lang } = useT();
  const [when, setWhen] = useState(i.scheduled_for ? i.scheduled_for.slice(0, 16) : ""); const [place, setPlace] = useState(i.place ?? "");
  const [checks, setChecks] = useState<Record<string, boolean>>(i.checklist ?? {}); const [report, setReport] = useState(i.report ?? "");
  const steps = itemInspectionAdminSteps(i);
  async function proof() { if (!i.pay_proof_path) return; const u = await paymentProofUrl(supabase(), i.pay_proof_path); if (u.data) window.open(u.data, "_blank", "noopener"); }
  function step(s: ItemInspectionStep) {
    if (s === "schedule") return run(() => itemInspectionStep(supabase(), i.id, s, { when: when ? new Date(when).toISOString() : null, place }));
    if (s === "approve" || s === "fail") {
      const full = Object.fromEntries(ITEM_INSPECTION_CHECKLIST[i.category].map(k => [k, !!checks[k]]));
      return run(() => itemInspectionStep(supabase(), i.id, s, { checklist: full, report }));
    }
    return run(() => itemInspectionStep(supabase(), i.id, s));
  }
  return <article className="card stack" style={{ gap: 8 }}>
    <strong>{itemInspectionRef(i.ref_no)} · {i.title} · {t("ii.cat." + i.category)}</strong>
    <small>{t("ii.mode." + i.mode)} · {i.requester_name ?? "—"} → {i.seller_name ?? "—"} · {formatPrice(i.fee)} · {eventDateIn(i.updated_at, lang)}</small>
    {i.mode === "buyer" && <small className="muted">{t("ii.a_buyer_mode")}</small>}
    {i.mode === "prebuy" && <small className="muted">{t("ii.a_prebuy_mode")}</small>}
    <span style={{ fontWeight: 800 }}>{t("ii.s." + i.status)}</span>
    {i.note && <small>💬 {i.note}</small>}
    {i.listing_id && <a href={"/classificados/" + i.listing_id} target="_blank" rel="noopener">{t("cg.view_listing")} →</a>}
    {i.status === "payment_submitted" && <div className="row">
      <small>{t("sv.reference")}: <strong>{i.pay_reference}</strong></small>
      {i.pay_proof_path && <button type="button" className="secondary" onClick={() => void proof()}>🧾 {t("im.a_proof")}</button>}
      <button type="button" onClick={() => void run(() => decideItemInspectionPayment(supabase(), i.id, true))}>{t("pp.confirm_pay")}</button>
      <button type="button" className="danger" onClick={() => { const w = prompt(t("pp.reject_why")) ?? ""; if (w.trim()) void run(() => decideItemInspectionPayment(supabase(), i.id, false, w)); }}>{t("pp.reject_pay")}</button>
    </div>}
    {steps.includes("schedule") && <div className="row">
      <label style={{ flex: 1, minWidth: 180 }}>{t("ii.a_when")}<input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} /></label>
      <label style={{ flex: 2, minWidth: 200 }}>{t("ii.a_place")}<input value={place} onChange={e => setPlace(e.target.value)} maxLength={300} /></label>
    </div>}
    {(steps.includes("approve")) && <div className="stack" style={{ gap: 6 }}>
      <div className="stack" style={{ gap: 4 }}>{ITEM_INSPECTION_CHECKLIST[i.category].map(k => <label key={k} className="check" style={{ fontWeight: 600 }}>
        <input type="checkbox" checked={!!checks[k]} onChange={e => setChecks({ ...checks, [k]: e.target.checked })} /> {t("ii.c." + k)}</label>)}</div>
      <label>{t("ii.a_report")}<textarea value={report} onChange={e => setReport(e.target.value)} rows={4} maxLength={2000} /></label>
    </div>}
    {steps.length > 0 && <div className="row">{steps.map(s => <button key={s} type="button" className={s === "fail" ? "danger" : s === "schedule" || s === "start" ? "secondary" : ""} onClick={() => void step(s)}>{t("ii.step." + s)}</button>)}</div>}
  </article>;
}
