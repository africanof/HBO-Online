"use client";
import { useEffect, useState } from "react";
import { getClaimDeadline, openListingClaim, respondListingClaim, buyerListingClaim, listMyListingClaims, listListingClaimsForAdmin, decideListingClaim,
  claimActions, claimRef, claimDeadlineText, parsePrice, formatPrice, friendlyErrorIn, LANG_TAGS, CONFORMITY_DECLARATION, CONFORMITY_GUARANTEE,
  CLAIM_REQUEST_LABELS, CLAIM_REASON_LABELS, CLAIM_STATUS_LABELS, CLAIM_OUTCOME_LABELS,
  type ClaimRequest, type ClaimReason, type ClaimStatus, type ListingClaim, type AdminListingClaim } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT, type TFunction } from "../lib/i18n";

/** Caixa obrigatória nos formulários de anúncio e de produto. */
export function ConformityCheck({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const { tc } = useT();
  return <label className="check card" style={{ alignItems: "flex-start", fontWeight: 600 }}>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} required style={{ marginTop: 4, flex: "none" }} />
    <span>✅ {tc(CONFORMITY_DECLARATION)}</span>
  </label>;
}

/** Na página do anúncio: a garantia e, para quem comprou/arrendou, «Não corresponde ao anúncio». */
export function ListingGuarantee({ listingId, uid, mine, wanted }: { listingId: string; uid: string | null; mine: boolean; wanted?: boolean }) {
  const { lang, t, tc } = useT();
  const [deadline, setDeadline] = useState<string | null>(null); const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ClaimReason | "">(""); const [request, setRequest] = useState<ClaimRequest | "">("");
  const [description, setDescription] = useState(""); const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState("");
  useEffect(() => { if (uid && !mine) void getClaimDeadline(supabase(), listingId).then(setDeadline); }, [listingId, uid, mine]);
  if (wanted) return null;
  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    const r = await openListingClaim(supabase(), listingId, { request, reason, description, amount: amount.trim() ? parsePrice(amount) : null });
    setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    setOpen(false); setDone(t("ls.claim_sent"));
  }
  return <section className="card" style={{ gap: 8 }}>
    <p style={{ margin: 0 }}>{tc(CONFORMITY_GUARANTEE)}</p>
    {done && <p className="ok" role="status" style={{ margin: 0 }}>{done}</p>}
    {deadline && !done && !open && <div className="row" style={{ alignItems: "center" }}>
      <button type="button" className="secondary" onClick={() => setOpen(true)}>↩️ {t("ls.claim_open_btn")}</button>
      <small>{tc(claimDeadlineText(deadline))}</small>
    </div>}
    {open && <form className="stack" onSubmit={send} style={{ gap: 8 }}>
      <fieldset className="stack" style={{ gap: 6, border: 0, padding: 0 }}><legend style={{ fontWeight: 700 }}>{t("ls.claim_whats_wrong")}</legend>
        {(Object.keys(CLAIM_REASON_LABELS) as ClaimReason[]).map(k => <label key={k} className="check"><input type="radio" name="reason" checked={reason === k} onChange={() => setReason(k)} /> {tc(CLAIM_REASON_LABELS[k])}</label>)}
      </fieldset>
      <fieldset className="stack" style={{ gap: 6, border: 0, padding: 0 }}><legend style={{ fontWeight: 700 }}>{t("ls.claim_what_want")}</legend>
        {(Object.keys(CLAIM_REQUEST_LABELS) as ClaimRequest[]).map(k => <label key={k} className="check"><input type="radio" name="request" checked={request === k} onChange={() => setRequest(k)} /> {tc(CLAIM_REQUEST_LABELS[k])}</label>)}
      </fieldset>
      {request && request !== "exchange" && <label>{t("ls.claim_refund_amount")}<input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></label>}
      <label>{t("ls.claim_explain")}<textarea rows={4} maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} placeholder={t("ls.claim_explain_ph")} /></label>
      <small>{t("ls.claim_photos_hint")}</small>
      {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
      <div className="row"><button type="submit" disabled={busy}>{busy ? t("ls.sending") : t("ls.claim_send")}</button><button type="button" className="secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</button></div>
    </form>}
  </section>;
}

type ClaimAction = "accept" | "decline" | "confirm" | "escalate" | "withdraw";
const actionLabel = (a: ClaimAction, t: TFunction) => ({ accept: "✅ " + t("ls.claim_act_accept"), decline: "❌ " + t("ls.decline"), confirm: "✔ " + t("ls.claim_act_confirm"), escalate: "⚖️ " + t("ls.claim_act_escalate"), withdraw: t("ls.claim_act_withdraw") })[a];

/** Lista das reclamações de anúncios (como comprador e como dono), na página «Devoluções e reembolsos». */
export function ListingClaims() {
  const { lang, t, tc } = useT();
  const [items, setItems] = useState<ListingClaim[]>([]); const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listMyListingClaims(supabase()); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void load(); }, []);
  async function act(c: ListingClaim, a: ClaimAction) {
    setBusy(true); setError(""); setNotice("");
    const n = note[c.id];
    const r = a === "accept" || a === "decline" ? await respondListingClaim(supabase(), c.id, a === "accept", n) : await buyerListingClaim(supabase(), c.id, a, n);
    setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    setNotice(t("ls.claim_updated")); setNote({ ...note, [c.id]: "" }); await load();
  }
  if (!items.length && !error) return null;
  return <section className="stack">
    <h2 style={{ margin: "8px 0 0" }}>🛡️ {t("ls.claims_title")}</h2>
    <p style={{ margin: 0 }}>{t("ls.claims_intro")}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items.map(c => { const acts = claimActions(c); return <article key={c.id} className="card" style={{ gap: 6 }}>
      <div className="row" style={{ justifyContent: "space-between" }}><strong>{claimRef(c.ref_no)} · {c.listing_id ? <a href={"/classificados/" + c.listing_id}>{c.listing_title}</a> : c.listing_title}</strong>
        <span className="badge">{tc(c.status === "resolved" && c.outcome ? CLAIM_OUTCOME_LABELS[c.outcome] : CLAIM_STATUS_LABELS[c.status])}</span></div>
      <span>{c.role === "buyer" ? t("ls.owner") : t("ls.buyer")}: {c.other_name} · {tc(CLAIM_REASON_LABELS[c.reason])} · {t("ls.asks", { what: tc(CLAIM_REQUEST_LABELS[c.request]) })}{c.amount ? " " + t("ls.of_amount", { amount: formatPrice(c.amount) }) : ""}</span>
      <span style={{ whiteSpace: "pre-wrap" }}>«{c.description}»</span>
      {c.seller_note && <span>{t("ls.owner_reply")} {c.seller_note}</span>}
      {c.admin_note && <span><strong>{t("ls.administration")}:</strong> {c.admin_note}</span>}
      {c.role === "seller" && c.status === "open" && <small>{t("ls.claim_reply_by", { d: new Date(c.respond_by).toLocaleString(LANG_TAGS[lang]) })}</small>}
      {c.role === "seller" && c.status === "accepted" && <small>{t("ls.claim_arrange", { what: tc(CLAIM_REQUEST_LABELS[c.request]).replace(/^\S+ /, "").toLowerCase() })}</small>}
      {acts.length > 0 && <>
        <label>{t("ls.claim_msg_required")}<input value={note[c.id] ?? ""} onChange={e => setNote({ ...note, [c.id]: e.target.value })} maxLength={1000} /></label>
        <div className="row">{acts.map(a => <button key={a} type="button" disabled={busy} className={a === "accept" || a === "confirm" ? "" : "secondary"} onClick={() => void act(c, a)}>{actionLabel(a, t)}</button>)}</div>
      </>}
    </article>; })}
  </section>;
}

/** Administração: reclamações para decidir. */
export function AdminListingClaims() {
  const { lang, t, tc } = useT();
  const [status, setStatus] = useState<ClaimStatus | "">("escalated"); const [items, setItems] = useState<AdminListingClaim[]>([]);
  const [note, setNote] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listListingClaimsForAdmin(supabase(), status); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void load(); }, [status]);
  async function decide(c: AdminListingClaim, uphold: boolean) {
    setBusy(true); setError(""); setNotice("");
    const r = await decideListingClaim(supabase(), c.id, uphold, note[c.id] ?? ""); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(uphold ? t("ls.claim_for_buyer") : t("ls.claim_declined")); await load(); }
  }
  return <section className="stack">
    <h2 style={{ margin: 0 }}>🛡️ {t("ls.claims_admin_title")}</h2>
    <div className="row" role="radiogroup" aria-label={t("ls.status")}>{(["escalated", "open", "accepted", "declined", "resolved", ""] as const).map(s => <button key={s || "all"} type="button" role="radio" aria-checked={status === s} className={status === s ? "" : "secondary"} onClick={() => setStatus(s)}>{s ? tc(CLAIM_STATUS_LABELS[s]) : t("ls.all_f")}</button>)}</div>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items.length === 0 && <p>{t("ls.nothing_here")}</p>}
    {items.map(c => <article key={c.id} className="card" style={{ gap: 6 }}>
      <strong>{claimRef(c.ref_no)} · {c.listing_id ? <a href={"/classificados/" + c.listing_id}>{c.listing_title}</a> : c.listing_title}</strong>
      <span>{t("ls.buyer")} {c.buyer_name} · {t("ls.owner")} {c.seller_name} ({t("ls.claims_total", { n: c.seller_claims })})</span>
      <span>{tc(CLAIM_REASON_LABELS[c.reason])} · {t("ls.asks", { what: tc(CLAIM_REQUEST_LABELS[c.request]) })}{c.amount ? " " + t("ls.of_amount", { amount: formatPrice(c.amount) }) : ""}</span>
      <span style={{ whiteSpace: "pre-wrap" }}>«{c.description}»</span>
      {c.seller_note && <span>{t("ls.owner_reply")} {c.seller_note}</span>}
      {c.admin_note && <span>{t("ls.note")} {c.admin_note}</span>}
      {c.status !== "resolved" && <>
        <label>{t("ls.claim_decision")}<textarea rows={2} value={note[c.id] ?? ""} onChange={e => setNote({ ...note, [c.id]: e.target.value })} maxLength={1000} /></label>
        <div className="row">
          <button type="button" disabled={busy} onClick={() => void decide(c, true)}>⚖️ {t("ls.claim_buyer_right")}</button>
          <button type="button" className="secondary" disabled={busy} onClick={() => void decide(c, false)}>{t("ls.claim_reject")}</button>
        </div>
        <small>{t("ls.claim_suspend_hint")}</small>
      </>}
    </article>)}
  </section>;
}
