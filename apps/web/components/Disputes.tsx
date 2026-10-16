"use client";
import { useEffect, useState } from "react";
import { disputeActions, disputeNextStep, platformRefunds, setDisputeRefundAccount, disputeEventLabel, disputeAction, disputePhotoUrls, uploadDisputePhoto, listDisputesForAdmin, decideDispute,
  formatPrice, friendlyErrorIn, LANG_TAGS, DISPUTE_STATUS_LABELS, DISPUTE_OUTCOME_LABELS, DISPUTE_REASON_LABELS, DISPUTE_REQUEST_LABELS, DISPUTE_ACTION_LABELS,
  DISPUTE_DECISION_LABELS, DISPUTE_MAX_PHOTOS, PAYMENT_LABELS, ORDER_STATUS_LABELS,
  type DisputeAction, type DisputeDecision, type DisputeEvent, type DisputeRole, type MyDispute, type AdminDispute, type DisputeStatus, type PaymentMethod, type OrderStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { compressPhoto } from "../lib/image";
import { useT } from "../lib/i18n";

/** Escolher até 4 fotografias de prova (reduzidas antes de enviar). */
export function EvidencePicker({ files, onChange, label }: { files: File[]; onChange: (f: File[]) => void; label?: string }) {
  const { t } = useT();
  return <label>{label ?? t("sh.dc.photos_opt")}
    <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => onChange([...files, ...Array.from(e.target.files ?? [])].slice(0, DISPUTE_MAX_PHOTOS))} />
    {files.length > 0 && <span className="row" style={{ gap: 6 }}>{files.map((f, i) => <span key={i} className="badge">📷 {f.name} <button type="button" className="secondary" aria-label={t("sh.dc.remove_file", { name: f.name })} onClick={() => onChange(files.filter((_, j) => j !== i))}>✖</button></span>)}</span>}
  </label>;
}
export async function uploadEvidence(orderId: string, uid: string, files: File[], failMsg = "Não foi possível enviar a fotografia."): Promise<string[]> {
  const out: string[] = [];
  for (const f of files) {
    const small = await compressPhoto(f);
    const r = await uploadDisputePhoto(supabase(), orderId, uid, small, small.name, small.type || "image/jpeg");
    if (r.error || !r.data) throw r.error ?? new Error(failMsg);
    out.push(r.data);
  }
  return out;
}

/** Histórico do pedido, com as fotografias abertas por ligação temporária (privadas). */
export function DisputeTimeline({ events }: { events: DisputeEvent[] }) {
  const { lang, t, tc } = useT();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const paths = events.flatMap(e => e.photos ?? []);
  useEffect(() => { if (paths.length) void disputePhotoUrls(supabase(), paths).then(setUrls); }, [paths.join("|")]);
  return <ol className="stack" style={{ gap: 8, margin: 0, paddingLeft: 20 }}>
    {events.map((e, i) => <li key={i}>
      <strong>{tc(disputeEventLabel(e))}</strong> <small className="muted">{new Date(e.created_at).toLocaleString(LANG_TAGS[lang])}</small>
      {e.note && <div style={{ overflowWrap: "anywhere" }}>{e.note}</div>}
      {(e.photos ?? []).length > 0 && <div className="row" style={{ gap: 6 }}>{e.photos.map(p => urls[p]
        ? <a key={p} href={urls[p]} target="_blank" rel="noopener"><img src={urls[p]} alt={t("sh.dc.evidence")} width={96} height={96} style={{ objectFit: "cover", borderRadius: 8 }} /></a>
        : <span key={p} className="badge">📷 {t("sh.dc.photo")}</span>)}</div>}
    </li>)}
  </ol>;
}

function StatusBadge({ status, outcome }: { status: DisputeStatus; outcome: MyDispute["outcome"] }) {
  const { tc } = useT();
  return <span className="badge">{tc(status === "resolved" && outcome ? DISPUTE_OUTCOME_LABELS[outcome] : DISPUTE_STATUS_LABELS[status])}</span>;
}

/** Um pedido visto pelo comprador ou pelo vendedor, com os botões do passo seguinte. */
export function DisputeCard({ d, uid, onChanged }: { d: MyDispute; uid: string; onChanged: (msg: string) => void }) {
  const { lang, t, tc } = useT();
  const [note, setNote] = useState(""); const [files, setFiles] = useState<File[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const role: DisputeRole = d.my_role;
  const actions = disputeActions(d, role);
  const [account, setAccount] = useState(d.refund_to ?? "");
  async function saveAccount() {
    setBusy(true); setError("");
    const r = await setDisputeRefundAccount(supabase(), d.id, account);
    setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else onChanged(t("sh.dc.account_saved"));
  }
  async function run(action: DisputeAction) {
    if (action === "decline" && !note.trim()) { setError(t("sh.dc.need_reason")); return; }
    if (action === "comment" && !note.trim() && !files.length) { setError(t("sh.dc.need_msg")); return; }
    if (action === "withdraw" && !confirm(t("sh.dc.withdraw_q"))) return;
    if ((action === "confirm_refund" || action === "confirm_replacement") && !confirm(action === "confirm_refund" ? t("sh.dc.got_money_q") : t("sh.dc.got_item_q"))) return;
    setBusy(true); setError("");
    try {
      const photos = await uploadEvidence(d.order_id, uid, files, t("sh.dc.photo_fail"));
      const r = await disputeAction(supabase(), d.id, action, note, photos);
      if (r.error) throw r.error;
      setNote(""); setFiles([]); onChanged(action === "comment" ? t("sh.msg_sent") : t("sh.dc.updated"));
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <article className="card" id={"pedido-" + d.id}>
    <strong>{tc(DISPUTE_REASON_LABELS[d.reason])} · <StatusBadge status={d.status} outcome={d.outcome} /></strong>
    <span>{role === "buyer" ? t("sh.seller") : t("sh.customer")}: {d.other_name} · {t("sh.dc.order_of", { total: formatPrice(d.order_total) })} · {new Date(d.created_at).toLocaleDateString(LANG_TAGS[lang])}</span>
    <span>{(d.order_items ?? []).map(i => `${i.quantity} × ${i.name}`).join(", ")}</span>
    <span>{t("sh.dc.request")}: <strong>{tc(DISPUTE_REQUEST_LABELS[d.request])}</strong>{d.amount != null ? <> · {t("sh.dc.value")}: <strong>{formatPrice(d.amount)}</strong></> : null}</span>
    {d.admin_note && <span>⚖️ {t("sh.dc.admin_decision")}: {d.admin_note}</span>}
    <p className="ok" style={{ margin: 0 }}>👉 {tc(disputeNextStep(d, role))}</p>
    {platformRefunds(d) && <span>🛡️ {t("sh.dc.held")}</span>}
    {role === "buyer" && platformRefunds(d) && d.status !== "resolved" && d.request !== "replacement" && <div className="card stack" style={{ gap: 8 }}>
      <label>{t("sh.dc.refund_where")}<input value={account} onChange={e => setAccount(e.target.value)} placeholder={t("sh.dc.refund_ph")} /></label>
      {d.refund_to && <small>{t("sh.dc.saved")}: <strong>{d.refund_to}</strong></small>}
      <button type="button" className="secondary" disabled={busy} style={{ justifySelf: "start" }} onClick={saveAccount}>{t("sh.dc.save_account")}</button>
    </div>}
    <details><summary>{t("sh.dc.history", { n: d.events.length })}</summary><DisputeTimeline events={d.events} /></details>
    {d.status !== "resolved" && <>
      <label>{t("sh.dc.message")}<textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder={role === "seller" && d.status === "open" ? t("sh.dc.reply_ph") : t("sh.dc.msg_ph")} /></label>
      <EvidencePicker files={files} onChange={setFiles} />
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        {actions.filter(a => a !== "withdraw").map(a => <button key={a} disabled={busy} className={a === "decline" || a === "escalate" ? "secondary" : ""} onClick={() => run(a)}>{tc(DISPUTE_ACTION_LABELS[a])}</button>)}
        <button disabled={busy} className="secondary" onClick={() => run("comment")}>💬 {tc(DISPUTE_ACTION_LABELS.comment)}</button>
        {actions.includes("withdraw") && <button disabled={busy} className="danger" onClick={() => run("withdraw")}>{tc(DISPUTE_ACTION_LABELS.withdraw)}</button>}
      </div>
    </>}
  </article>;
}

/** Administração: disputas para decidir e todas as outras. */
export function AdminDisputes() {
  const { lang, t, tc } = useT();
  const [status, setStatus] = useState<DisputeStatus | "active" | "escrow_refunds" | "">("escalated");
  const [items, setItems] = useState<AdminDispute[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listDisputesForAdmin(supabase(), status); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void load(); }, [status]);
  async function decide(d: AdminDispute, decision: DisputeDecision) {
    let amount: number | null = null;
    if (decision === "refund" || decision === "return_refund") {
      const v = prompt(t("sh.ad.amount_q"), String(Number(d.amount ?? d.order_total)));
      if (v === null) return;
      amount = Number(v.replace(/\s/g, "").replace(",", "."));
      if (!Number.isFinite(amount) || amount <= 0) { setError(t("sh.invalid_amount")); return; }
    }
    const note = prompt(t("sh.ad.explain_q")) ?? "";
    if (!note.trim()) return;
    setError(""); setNotice("");
    const r = await decideDispute(supabase(), d.id, decision, note, amount);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("sh.ad.decided")); await load(); }
  }
  async function refundStep(d: AdminDispute, action: "mark_refunded" | "confirm_refund") {
    const note = action === "mark_refunded"
      ? prompt(t("sh.ad.sent_q", { amount: formatPrice(d.amount ?? d.order_total), dest: d.refund_to ?? "" })) ?? ""
      : prompt(t("sh.ad.close_q")) ?? "";
    if (!note.trim()) return;
    setError(""); setNotice("");
    const r = await disputeAction(supabase(), d.id, action, note);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(action === "mark_refunded" ? t("sh.ad.marked") : t("sh.ad.closed")); await load(); }
  }
  async function comment(d: AdminDispute) {
    const note = prompt(t("sh.ad.msg_q")) ?? "";
    if (!note.trim()) return;
    const r = await disputeAction(supabase(), d.id, "comment", note);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("sh.msg_sent")); await load(); }
  }
  return <section className="stack">
    <p>{t("sh.ad.intro")}</p>
    <label style={{ maxWidth: 300 }}>{t("sh.show")}<select value={status} onChange={e => setStatus(e.target.value as any)}>
      <option value="escalated">{t("sh.ad.to_decide")}</option><option value="escrow_refunds">💸 {t("sh.ad.escrow_refunds")}</option><option value="active">{t("sh.ad.all_open")}</option><option value="">{t("sh.all_m")}</option>
      {(Object.keys(DISPUTE_STATUS_LABELS) as DisputeStatus[]).filter(s => s !== "escalated").map(s => <option key={s} value={s}>{tc(DISPUTE_STATUS_LABELS[s])}</option>)}
    </select></label>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items.length === 0 && <p>{t("sh.ad.none")}</p>}
    {items.map(d => <article key={d.id} className="card">
      <strong>{tc(DISPUTE_REASON_LABELS[d.reason])} · <StatusBadge status={d.status} outcome={d.outcome} /></strong>
      <span>{t("sh.buyer")}: <a href={"/vendedor/" + d.buyer_id} target="_blank">{d.buyer_name}</a> · {t("sh.seller")}: <a href={"/vendedor/" + d.seller_id} target="_blank">{d.seller_name}</a></span>
      <span>{t("sh.dc.order_of", { total: formatPrice(d.order_total) })} · {tc(ORDER_STATUS_LABELS[d.order_status as OrderStatus] ?? d.order_status)} · {tc(PAYMENT_LABELS[d.payment_method as PaymentMethod] ?? d.payment_method ?? "")}</span>
      <span>{t("sh.dc.request")}: <strong>{tc(DISPUTE_REQUEST_LABELS[d.request])}</strong>{d.amount != null ? <> · {formatPrice(d.amount)}</> : null}</span>
      {d.admin_note && <span>{t("sh.ad.decision")}: {d.admin_note}</span>}
      {platformRefunds(d) && <span>🛡️ {t("sh.ad.held")}{d.order_ref ? " · " + d.order_ref : ""} · {t("sh.ad.refund_to")}: <strong>{d.refund_to ?? t("sh.ad.not_given")}</strong></span>}
      {platformRefunds(d) && d.status === "awaiting_refund" && <div className="row">
        <button disabled={!d.refund_to} onClick={() => refundStep(d, "mark_refunded")}>💸 {t("sh.ad.mark_sent")}</button>
      </div>}
      {platformRefunds(d) && d.status === "refund_sent" && <div className="row">
        <button className="secondary" onClick={() => refundStep(d, "confirm_refund")}>✔ {t("sh.ad.close")}</button>
      </div>}
      <DisputeTimeline events={d.events} />
      {d.status !== "resolved" && <div className="row">
        {(Object.keys(DISPUTE_DECISION_LABELS) as DisputeDecision[]).map(k => <button key={k} className={k === "reject" ? "danger" : k === "refund" ? "" : "secondary"} onClick={() => decide(d, k)}>{tc(DISPUTE_DECISION_LABELS[k])}</button>)}
        <button className="secondary" onClick={() => comment(d)}>💬 {t("sh.dc.message")}</button>
      </div>}
    </article>)}
  </section>;
}
