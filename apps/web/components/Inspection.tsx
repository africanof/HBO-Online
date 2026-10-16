"use client";
import { useEffect, useState } from "react";
import { inspectedMap, inspectionBadgeText, isInspected, requestInspection, cancelInspection, myInspections, listInspectionsForAdmin, scheduleInspection,
  decideInspection, revokeInspection, hasStore, inspectionFee, submitInspectionPayment, decideInspectionPayment, INSPECTION_FEE_NOTE, paymentProofUrl, uploadPaymentProof,
  validateDocument, formatPrice, PLAN_METHOD_LABELS, type PaymentMethodPlan, getProvider, listMyBusinesses, getPlatformSettings, updatePlatformSettings, friendlyErrorIn, inspectionRef, scheduledText, LANG_TAGS,
  INSPECTION_BADGE, INSPECTION_EXPLAINED, INSPECTION_KIND_LABELS, INSPECTION_STATUS_LABELS, INSPECTION_CHECKLIST,
  type InspectedInfo, type InspectionKind, type InspectionStatus, type MyInspection, type AdminInspection, type PlatformSettings } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { useT } from "../lib/i18n";
import { PaymentDetails } from "./Plans";

/** 🏅 Selo «Inspecionado» (só aparece se estiver válido). */
export function InspectedBadge({ info, big }: { info?: InspectedInfo | null; big?: boolean }) {
  const { tc } = useT();
  if (!isInspected(info)) return null;
  const text = tc(inspectionBadgeText(info));
  return big
    ? <p className="card" style={{ margin: 0, gap: 4, borderColor: "var(--ok)" }}><strong className="verified" style={{ fontSize: 18 }}>{tc(INSPECTION_BADGE)}</strong><span>{tc(INSPECTION_EXPLAINED)}</span><small>{text}</small></p>
    : <span className="verified" title={tc(INSPECTION_EXPLAINED) + " " + text}>{tc(INSPECTION_BADGE)}</span>;
}
/** Selos de uma lista (um pedido só para todos). */
export function useInspected(kind: InspectionKind, ids: (string | null | undefined)[]) {
  const [map, setMap] = useState<Record<string, InspectedInfo>>({});
  const key = ids.filter(Boolean).join(",");
  useEffect(() => { if (key) void inspectedMap(supabase(), kind, ids).then(setMap); }, [kind, key]);
  return map;
}

type Target = { kind: InspectionKind; id: string; name: string };

/** Página do dono: pedir a inspeção dos seus perfis, empresas/fábricas e loja. */
export function MyInspectionsPage() {
  const { lang, t, tc } = useT();
  const translate = t;
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [targets, setTargets] = useState<Target[] | null>(null);
  const [items, setItems] = useState<MyInspection[]>([]); const [badges, setBadges] = useState<Record<string, InspectedInfo>>({});
  const [open, setOpen] = useState<string | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  async function load(u: string) {
    const c = supabase();
    const [p, b, s, m, st] = await Promise.all([getProvider(c, u), listMyBusinesses(c, u), hasStore(c, u), myInspections(c), getPlatformSettings(c)]);
    setSettings(st.data);
    const t: Target[] = []; const tr = translate;
    if (p.data) t.push({ kind: "provider", id: u, name: (p.data as any).display_name });
    for (const x of (b.data ?? []) as any[]) t.push({ kind: "business", id: x.id, name: x.name });
    if (s) t.push({ kind: "store", id: u, name: tr("sv.in_my_store") });
    setTargets(t); setItems(m.data);
    const maps = await Promise.all((["provider", "business", "store"] as InspectionKind[]).map(k => inspectedMap(c, k, t.filter(x => x.kind === k).map(x => x.id))));
    setBadges(Object.fromEntries(t.map(x => [x.kind + x.id, maps[["provider", "business", "store"].indexOf(x.kind)][x.id]]).filter(([, v]) => v)));
  }
  useEffect(() => { void currentUserId().then(u => { setUid(u); if (u) void load(u); }); }, []);
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main className="stack"><h1>🏅 {t("sv.in_title")}</h1><a className="btn" href="/conta/login?voltar=/inspecao">{t("auth.login")}</a></main>;
  async function cancel(i: MyInspection) {
    if (!confirm(t("sv.in_cancel_q"))) return;
    const r = await cancelInspection(supabase(), i.id); if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("sv.request_cancelled")); void load(uid!); }
  }
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href="/conta">← {t("nav.account")}</a>
    <h1 style={{ margin: 0 }}>🏅 {t("sv.in_title")}</h1>
    <p style={{ margin: 0 }}>{tc(INSPECTION_EXPLAINED)} {t("sv.in_intro")}</p>
    <p className="muted" style={{ margin: 0 }}>{t("sv.in_diff")}</p>
    <p className="card" style={{ margin: 0 }}>💳 {t("sv.in_fee", { pro: formatPrice(inspectionFee("provider", settings)), biz: formatPrice(inspectionFee("business", settings)) })} {tc(INSPECTION_FEE_NOTE)}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {targets === null ? <p>{t("common.loading")}</p> : targets.length === 0 ? <p className="card" style={{ margin: 0 }}>{t("sv.in_first")} <a href="/conta/profissional">{t("sv.in_first_pro")}</a>, <a href="/conta/empresas">{t("sv.in_first_biz")}</a>, {t("sv.in_first_or")} <a href="/conta/produtos">{t("sv.in_first_store")}</a>.</p> :
      targets.map(tg => { const k = tg.kind + tg.id; const last = items.find(i => i.kind === tg.kind && i.target_id === tg.id);
        const busy = last && ["awaiting_payment", "payment_submitted", "requested", "scheduled"].includes(last.status);
        const canCancel = last && (last.status === "awaiting_payment" || (last.fee_amount === 0 && (last.status === "requested" || last.status === "scheduled")));
        return <article key={k} className="card stack" style={{ gap: 8, minWidth: 0, overflowWrap: "anywhere" }}>
          <strong style={{ fontSize: 19 }}>{tc(INSPECTION_KIND_LABELS[tg.kind])} · {tg.name}</strong>
          {badges[k] ? <InspectedBadge info={badges[k]} big /> : null}
          {last && <span>{inspectionRef(last.ref_no)} · {tc(INSPECTION_STATUS_LABELS[last.status])}{last.status === "scheduled" && last.scheduled_for ? " — " + tc(scheduledText(last.scheduled_for)) : ""}</span>}
          {last?.admin_note && (last.status === "rejected" || last.status === "revoked" || last.status === "scheduled" || last.status === "awaiting_payment") && <span className={last.status === "scheduled" ? "" : "error"}>{t("sv.vf_admin_note")}: {last.admin_note}</span>}
          {last?.status === "awaiting_payment" && <PayBox i={last} uid={uid} settings={settings} onDone={m => { setNotice(m); setError(""); void load(uid!); }} />}
          {busy ? (canCancel ? <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => void cancel(last!)}>{t("sv.cancel_request")}</button> : null)
            : open === k ? <RequestForm t={tg} onDone={m => { setOpen(null); setNotice(m); setError(""); void load(uid!); }} onClose={() => setOpen(null)} />
            : <button type="button" style={{ justifySelf: "start" }} onClick={() => setOpen(k)}>{badges[k] ? "🔁 " + t("sv.in_request_again") : "🏅 " + t("sv.in_request")} ({formatPrice(inspectionFee(tg.kind, settings))})</button>}
        </article>; })}
  </main>;
}
function RequestForm({ t: tg, onDone, onClose }: { t: Target; onDone: (m: string) => void; onClose: () => void }) {
  const { lang, t, tc } = useT();
  const [address, setAddress] = useState(""); const [phone, setPhone] = useState(""); const [when, setWhen] = useState(""); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    const r = await requestInspection(supabase(), tg.kind, tg.id, { address, phone, preferredTime: when, note }); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else onDone(t("sv.in_created"));
  }
  return <form className="stack" style={{ gap: 8 }} onSubmit={send}>
    <small>{tc(INSPECTION_FEE_NOTE)}</small>
    <label>{t("sv.in_address")}<textarea value={address} onChange={e => setAddress(e.target.value)} maxLength={300} rows={2} placeholder={t("sv.in_address_ph")} /></label>
    <label>{t("sv.in_phone")}<input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" maxLength={20} /></label>
    <label>{t("sv.in_when")}<input value={when} onChange={e => setWhen(e.target.value)} maxLength={120} placeholder={t("sv.in_when_ph")} /></label>
    <label>{t("sv.note_opt")}<input value={note} onChange={e => setNote(e.target.value)} maxLength={500} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="row"><button type="submit" disabled={busy}>{busy ? t("sv.sending") : "✅ " + t("sv.send_request")}</button><button type="button" className="secondary" onClick={onClose}>{t("common.cancel")}</button></div>
  </form>;
}

/** Pagar a taxa da marcação à plataforma e enviar a referência/comprovativo. */
function PayBox({ i, uid, settings, onDone }: { i: MyInspection; uid: string; settings: PlatformSettings | null; onDone: (m: string) => void }) {
  const { lang, t, tc } = useT();
  const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express"); const [reference, setReference] = useState(""); const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function send() {
    if (!reference.trim() && !file) { setError(t("sv.need_ref_or_proof")); return; }
    if (file) { const bad = validateDocument({ size: file.size, type: file.type }); if (bad) { setError(tc(bad)); return; } }
    setBusy(true); setError("");
    try {
      let proof: string | null = null;
      if (file) { const up = await uploadPaymentProof(supabase(), uid, file, file.name, file.type); if (up.error || !up.data) throw up.error ?? new Error(t("sv.proof_fail")); proof = up.data; }
      const r = await submitInspectionPayment(supabase(), i.id, { method, reference, proofPath: proof }); if (r.error) throw r.error;
      onDone(t("sv.in_pay_sent"));
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <div className="card stack" style={{ gap: 10, minWidth: 0 }}>
    <strong>1. {t("sv.in_pay_step", { amount: formatPrice(i.fee_amount) })}</strong>
    <PaymentDetails s={settings} />
    <small>{t("sv.in_desc_write")}: {inspectionRef(i.ref_no)}</small>
    <strong>2. {t("sv.tell_how_paid")}</strong>
    <div className="row" role="radiogroup" aria-label={t("sv.how_paid")}>{(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(m => <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? "" : "secondary"} onClick={() => setMethod(m)}>{tc(PLAN_METHOD_LABELS[m])}</button>)}</div>
    <label>{t("sv.ref_label")}<input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} /></label>
    <label>{t("sv.in_proof")}<input style={{ maxWidth: "100%" }} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <button type="button" disabled={busy} style={{ justifySelf: "start" }} onClick={() => void send()}>{busy ? t("sv.sending") : "✅ " + t("sv.ev_paid")}</button>
  </div>;
}

/** Administração: marcar visitas, aprovar com a lista do que foi visto, recusar e retirar selos. */
export function AdminInspections() {
  const { lang, t, tc } = useT();
  const [status, setStatus] = useState<InspectionStatus | "">("payment_submitted"); const [items, setItems] = useState<AdminInspection[]>([]); const [s, setS] = useState<PlatformSettings | null>(null);
  const [open, setOpen] = useState<string | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const [a, b] = await Promise.all([listInspectionsForAdmin(supabase(), status), getPlatformSettings(supabase())]);
    if (a.error) setError(friendlyErrorIn(a.error, lang)); setItems(a.data); setS(b.data);
  }
  useEffect(() => { void load(); }, [status]);
  const done = (m: string) => { setNotice(m); setError(""); setOpen(null); void load(); };
  async function saveMonths(e: React.FormEvent) {
    e.preventDefault(); const m = Number(s?.inspection_valid_months), f1 = Number(s?.inspection_fee_provider_kz), f2 = Number(s?.inspection_fee_kz);
    if (!Number.isInteger(m) || m < 1 || m > 60) { setError(t("sv.in_adm_months")); return; }
    if (!(f1 >= 0) || !(f2 >= 0)) { setError(t("sv.in_adm_fees")); return; }
    const r = await updatePlatformSettings(supabase(), { inspection_valid_months: m, inspection_fee_provider_kz: f1, inspection_fee_kz: f2 }); if (r.error) setError(friendlyErrorIn(r.error, lang)); else done(t("sv.rule_saved"));
  }
  return <section className="stack">
    <h2 style={{ margin: 0 }}>🏅 {t("sv.in_adm_title")}</h2>
    <small>{t("sv.in_adm_hint")}</small>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {s && <form className="card row" style={{ alignItems: "end" }} onSubmit={saveMonths}>
      <label style={{ flex: 1, minWidth: 160 }}>{t("sv.in_adm_fee_pro")}<input value={String(s.inspection_fee_provider_kz ?? "")} onChange={e => setS({ ...s, inspection_fee_provider_kz: e.target.value })} inputMode="numeric" /></label>
      <label style={{ flex: 1, minWidth: 160 }}>{t("sv.in_adm_fee_biz")}<input value={String(s.inspection_fee_kz ?? "")} onChange={e => setS({ ...s, inspection_fee_kz: e.target.value })} inputMode="numeric" /></label>
      <label style={{ flex: 1, minWidth: 160 }}>{t("sv.in_adm_valid")}<input value={String(s.inspection_valid_months ?? "")} onChange={e => setS({ ...s, inspection_valid_months: Number(e.target.value) || 0 })} inputMode="numeric" /></label>
      <button type="submit">{t("common.save")}</button></form>}
    <div className="chips" role="group" aria-label={t("sv.status")}>{([["payment_submitted", "💳 " + t("sv.in_f_payments")], ["requested", "⏳ " + t("sv.in_f_paid")], ["scheduled", "📅 " + t("sv.in_f_scheduled")], ["approved", "🏅 " + t("sv.in_f_approved")], ["rejected", "❌ " + t("sv.in_f_rejected")], ["", t("sv.all_f")]] as const).map(([k, l]) =>
      <button key={k || "all"} type="button" className={"chip" + (status === k ? " on" : "")} aria-pressed={status === k} onClick={() => setStatus(k)}>{l}</button>)}</div>
    {items.length === 0 && <p className="muted" style={{ margin: 0 }}>{t("sv.nothing_list")}</p>}
    {items.map(i => <article key={i.id} className="card stack" style={{ gap: 6 }}>
      <strong>{tc(INSPECTION_KIND_LABELS[i.kind])}{i.category_slug === "fabricas" ? " (🏭 " + t("sv.in_factory") + ")" : ""} · {i.target_name ?? "—"}</strong>
      <small>{inspectionRef(i.ref_no)} · {tc(INSPECTION_STATUS_LABELS[i.status])} · {t("sv.owner")}: {i.owner_name}{i.phone ? " · 📞 " + i.phone : ""}</small>
      {i.fee_amount > 0 && <small>{t("sv.fee_cap")} {formatPrice(i.fee_amount)}{i.pay_reference ? " · " + t("sv.ref_short") + ": " + i.pay_reference : ""}{i.pay_method ? " · " + tc(PLAN_METHOD_LABELS[i.pay_method as PaymentMethodPlan] ?? i.pay_method) : ""}{i.paid_at ? " · ✅ " + t("sv.paid") : ""}</small>}
      {i.address && <span>📍 {i.address}</span>}
      {i.preferred_time && <small>{t("sv.in_pref")}: {i.preferred_time}</small>}
      {i.note && <small>{t("sv.note")}: {i.note}</small>}
      {i.scheduled_for && <span>📅 {t("sv.in_visit")}: {tc(scheduledText(i.scheduled_for))}{i.inspector_name ? " · " + i.inspector_name : ""}</span>}
      {i.valid_until && i.status === "approved" && <span className="verified">{tc(INSPECTION_BADGE)} {t("sv.until")} {new Date(i.valid_until).toLocaleDateString(LANG_TAGS[lang])}</span>}
      {i.admin_note && <small>{t("sv.vf_admin_note")}: {i.admin_note}</small>}
      <div className="row"><a className="btn secondary" href={i.kind === "provider" ? "/profissionais/" + i.target_id : i.kind === "business" ? "/empresas/" + i.target_id : "/vendedor/" + i.target_id}>👁️ {t("sv.view")}</a>
        {i.pay_proof_path && <button type="button" className="secondary" onClick={async () => { const r = await paymentProofUrl(supabase(), i.pay_proof_path!); if (r.data) window.open(r.data, "_blank", "noopener"); }}>📄 {t("sv.proof")}</button>}
        {i.status === "payment_submitted" && <button type="button" onClick={async () => { if (!confirm(t("sv.in_received_q", { amount: formatPrice(i.fee_amount) }))) return;
          const r = await decideInspectionPayment(supabase(), i.id, true); if (r.error) setError(friendlyErrorIn(r.error, lang)); else done(t("sv.in_fee_ok")); }}>✅ {t("sv.in_got_fee")}</button>}
        {i.status === "payment_submitted" && <button type="button" className="secondary" onClick={async () => { const why = prompt(t("sv.why_not_confirm_owner")) ?? ""; if (!why.trim()) return;
          const r = await decideInspectionPayment(supabase(), i.id, false, why); if (r.error) setError(friendlyErrorIn(r.error, lang)); else done(t("sv.in_pay_refused")); }}>❌ {t("sv.not_received")}</button>}
        {(i.status === "requested" || i.status === "scheduled") && <button type="button" className="secondary" onClick={() => setOpen(open === "s" + i.id ? null : "s" + i.id)}>📅 {t("sv.in_schedule")}</button>}
        {(i.status === "requested" || i.status === "scheduled") && <button type="button" onClick={() => setOpen(open === "d" + i.id ? null : "d" + i.id)}>📝 {t("sv.in_result")}</button>}
        {i.status === "approved" && <button type="button" className="secondary" onClick={async () => { const why = prompt(t("sv.in_why_revoke")) ?? ""; if (!why.trim()) return;
          const r = await revokeInspection(supabase(), i.id, why); if (r.error) setError(friendlyErrorIn(r.error, lang)); else done(t("sv.in_revoked")); }}>⛔ {t("sv.in_revoke")}</button>}
      </div>
      {open === "s" + i.id && <ScheduleForm i={i} onDone={done} onError={setError} />}
      {open === "d" + i.id && <DecideForm i={i} onDone={done} onError={setError} />}
    </article>)}
  </section>;
}
function ScheduleForm({ i, onDone, onError }: { i: AdminInspection; onDone: (m: string) => void; onError: (m: string) => void }) {
  const { lang, t } = useT();
  const [when, setWhen] = useState(""); const [who, setWho] = useState(i.inspector_name ?? ""); const [note, setNote] = useState("");
  async function send(e: React.FormEvent) { e.preventDefault(); const r = await scheduleInspection(supabase(), i.id, when, who, note); if (r.error) onError(friendlyErrorIn(r.error, lang)); else onDone(t("sv.in_scheduled")); }
  return <form className="stack" style={{ gap: 8 }} onSubmit={send}>
    <label>{t("sv.in_datetime")}<input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} /></label>
    <label>{t("sv.in_who")}<input value={who} onChange={e => setWho(e.target.value)} maxLength={80} /></label>
    <label>{t("sv.in_note_owner")}<input value={note} onChange={e => setNote(e.target.value)} maxLength={500} /></label>
    <button type="submit" style={{ justifySelf: "start" }}>{t("sv.in_schedule_notify")}</button>
  </form>;
}
function DecideForm({ i, onDone, onError }: { i: AdminInspection; onDone: (m: string) => void; onError: (m: string) => void }) {
  const { lang, t, tc } = useT();
  const [check, setCheck] = useState<Record<string, boolean>>({}); const [note, setNote] = useState("");
  async function decide(ok: boolean) {
    if (ok && !check.exists) { onError(t("sv.in_must_exist")); return; }
    if (ok && !confirm(t("sv.in_give_q", { name: i.target_name ?? "" }))) return;
    const r = await decideInspection(supabase(), i.id, ok, check, note); if (r.error) onError(friendlyErrorIn(r.error, lang)); else onDone(ok ? t("sv.in_given") : t("sv.in_refused"));
  }
  return <div className="stack" style={{ gap: 8 }}>
    <strong>{t("sv.in_what_confirmed")}</strong>
    {INSPECTION_CHECKLIST.map(c => <label key={c.key} className="row" style={{ alignItems: "center", gap: 8, fontWeight: 400 }}>
      <input type="checkbox" checked={!!check[c.key]} onChange={e => setCheck({ ...check, [c.key]: e.target.checked })} style={{ width: 24, height: 24 }} />{tc(c.label)}{c.required ? " " + t("sv.required") : ""}</label>)}
    <label>{t("sv.in_note_refuse")}<input value={note} onChange={e => setNote(e.target.value)} maxLength={500} /></label>
    <div className="row"><button type="button" onClick={() => void decide(true)}>🏅 {t("sv.in_approve")}</button><button type="button" className="secondary" onClick={() => void decide(false)}>❌ {t("sv.refuse")}</button></div>
  </div>;
}
