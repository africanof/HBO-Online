"use client";
import { useEffect, useState } from "react";
import { getClaimDeadline, openListingClaim, respondListingClaim, buyerListingClaim, listMyListingClaims, listListingClaimsForAdmin, decideListingClaim,
  claimActions, claimRef, claimDeadlineText, parsePrice, formatPrice, friendlyError, CONFORMITY_DECLARATION, CONFORMITY_GUARANTEE,
  CLAIM_REQUEST_LABELS, CLAIM_REASON_LABELS, CLAIM_STATUS_LABELS, CLAIM_OUTCOME_LABELS,
  type ClaimRequest, type ClaimReason, type ClaimStatus, type ListingClaim, type AdminListingClaim } from "@huambo-online/core";
import { supabase } from "../lib/supabase";

/** Caixa obrigatória nos formulários de anúncio e de produto. */
export function ConformityCheck({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="check card" style={{ alignItems: "flex-start", fontWeight: 600 }}>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} required style={{ marginTop: 4, flex: "none" }} />
    <span>✅ {CONFORMITY_DECLARATION}</span>
  </label>;
}

/** Na página do anúncio: a garantia e, para quem comprou/arrendou, «Não corresponde ao anúncio». */
export function ListingGuarantee({ listingId, uid, mine, wanted }: { listingId: string; uid: string | null; mine: boolean; wanted?: boolean }) {
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
    if (r.error) { setError(friendlyError(r.error)); return; }
    setOpen(false); setDone("Reclamação enviada ao dono. Ele tem 3 dias para responder; se não responder ou recusar, pode pedir à administração para decidir. Acompanhe em «Devoluções e reembolsos».");
  }
  return <section className="card" style={{ gap: 8 }}>
    <p style={{ margin: 0 }}>{CONFORMITY_GUARANTEE}</p>
    {done && <p className="ok" role="status" style={{ margin: 0 }}>{done}</p>}
    {deadline && !done && !open && <div className="row" style={{ alignItems: "center" }}>
      <button type="button" className="secondary" onClick={() => setOpen(true)}>↩️ O artigo não corresponde ao anúncio</button>
      <small>{claimDeadlineText(deadline)}</small>
    </div>}
    {open && <form className="stack" onSubmit={send} style={{ gap: 8 }}>
      <fieldset className="stack" style={{ gap: 6, border: 0, padding: 0 }}><legend style={{ fontWeight: 700 }}>O que está errado?</legend>
        {(Object.keys(CLAIM_REASON_LABELS) as ClaimReason[]).map(k => <label key={k} className="check"><input type="radio" name="reason" checked={reason === k} onChange={() => setReason(k)} /> {CLAIM_REASON_LABELS[k]}</label>)}
      </fieldset>
      <fieldset className="stack" style={{ gap: 6, border: 0, padding: 0 }}><legend style={{ fontWeight: 700 }}>O que quer?</legend>
        {(Object.keys(CLAIM_REQUEST_LABELS) as ClaimRequest[]).map(k => <label key={k} className="check"><input type="radio" name="request" checked={request === k} onChange={() => setRequest(k)} /> {CLAIM_REQUEST_LABELS[k]}</label>)}
      </fieldset>
      {request && request !== "exchange" && <label>Valor a reembolsar (Kz, opcional)<input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></label>}
      <label>Explique o problema<textarea rows={4} maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex.: o anúncio não dizia que o ecrã está riscado." /></label>
      <small>Pode enviar fotografias ao dono pelas mensagens do anúncio.</small>
      {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
      <div className="row"><button type="submit" disabled={busy}>{busy ? "A enviar…" : "Enviar reclamação"}</button><button type="button" className="secondary" onClick={() => setOpen(false)}>Cancelar</button></div>
    </form>}
  </section>;
}

const ACTION_LABELS = { accept: "✅ Aceitar (vou cumprir)", decline: "❌ Recusar", confirm: "✔ Já está resolvido", escalate: "⚖️ Pedir à administração", withdraw: "Retirar a reclamação" } as const;

/** Lista das reclamações de anúncios (como comprador e como dono), na página «Devoluções e reembolsos». */
export function ListingClaims() {
  const [items, setItems] = useState<ListingClaim[]>([]); const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listMyListingClaims(supabase()); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useEffect(() => { void load(); }, []);
  async function act(c: ListingClaim, a: keyof typeof ACTION_LABELS) {
    setBusy(true); setError(""); setNotice("");
    const n = note[c.id];
    const r = a === "accept" || a === "decline" ? await respondListingClaim(supabase(), c.id, a === "accept", n) : await buyerListingClaim(supabase(), c.id, a, n);
    setBusy(false);
    if (r.error) { setError(friendlyError(r.error)); return; }
    setNotice("Reclamação atualizada. A outra pessoa recebe um aviso."); setNote({ ...note, [c.id]: "" }); await load();
  }
  if (!items.length && !error) return null;
  return <section className="stack">
    <h2 style={{ margin: "8px 0 0" }}>🛡️ Reclamações de anúncios</h2>
    <p style={{ margin: 0 }}>Quando o artigo comprado ou arrendado não corresponde ao anúncio.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items.map(c => { const acts = claimActions(c); return <article key={c.id} className="card" style={{ gap: 6 }}>
      <div className="row" style={{ justifyContent: "space-between" }}><strong>{claimRef(c.ref_no)} · {c.listing_id ? <a href={"/classificados/" + c.listing_id}>{c.listing_title}</a> : c.listing_title}</strong>
        <span className="badge">{c.status === "resolved" && c.outcome ? CLAIM_OUTCOME_LABELS[c.outcome] : CLAIM_STATUS_LABELS[c.status]}</span></div>
      <span>{c.role === "buyer" ? "Dono" : "Comprador"}: {c.other_name} · {CLAIM_REASON_LABELS[c.reason]} · pede {CLAIM_REQUEST_LABELS[c.request]}{c.amount ? " de " + formatPrice(c.amount) : ""}</span>
      <span style={{ whiteSpace: "pre-wrap" }}>«{c.description}»</span>
      {c.seller_note && <span>Resposta do dono: {c.seller_note}</span>}
      {c.admin_note && <span><strong>Administração:</strong> {c.admin_note}</span>}
      {c.role === "seller" && c.status === "open" && <small>Responda até {new Date(c.respond_by).toLocaleString("pt-AO")}. Sem resposta, a administração decide.</small>}
      {c.role === "seller" && c.status === "accepted" && <small>Combine com o comprador pela mensagem e faça {CLAIM_REQUEST_LABELS[c.request].replace(/^\S+ /, "").toLowerCase()}.</small>}
      {acts.length > 0 && <>
        <label>Mensagem (obrigatória para recusar)<input value={note[c.id] ?? ""} onChange={e => setNote({ ...note, [c.id]: e.target.value })} maxLength={1000} /></label>
        <div className="row">{acts.map(a => <button key={a} type="button" disabled={busy} className={a === "accept" || a === "confirm" ? "" : "secondary"} onClick={() => void act(c, a)}>{ACTION_LABELS[a]}</button>)}</div>
      </>}
    </article>; })}
  </section>;
}

/** Administração: reclamações para decidir. */
export function AdminListingClaims() {
  const [status, setStatus] = useState<ClaimStatus | "">("escalated"); const [items, setItems] = useState<AdminListingClaim[]>([]);
  const [note, setNote] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listListingClaimsForAdmin(supabase(), status); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useEffect(() => { void load(); }, [status]);
  async function decide(c: AdminListingClaim, uphold: boolean) {
    setBusy(true); setError(""); setNotice("");
    const r = await decideListingClaim(supabase(), c.id, uphold, note[c.id] ?? ""); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(uphold ? "Decidido a favor do comprador." : "Reclamação recusada."); await load(); }
  }
  return <section className="stack">
    <h2 style={{ margin: 0 }}>🛡️ Reclamações de anúncios (conformidade)</h2>
    <div className="row" role="radiogroup" aria-label="Estado">{(["escalated", "open", "accepted", "declined", "resolved", ""] as const).map(s => <button key={s || "all"} type="button" role="radio" aria-checked={status === s} className={status === s ? "" : "secondary"} onClick={() => setStatus(s)}>{s ? CLAIM_STATUS_LABELS[s] : "Todas"}</button>)}</div>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items.length === 0 && <p>Nada aqui.</p>}
    {items.map(c => <article key={c.id} className="card" style={{ gap: 6 }}>
      <strong>{claimRef(c.ref_no)} · {c.listing_id ? <a href={"/classificados/" + c.listing_id}>{c.listing_title}</a> : c.listing_title}</strong>
      <span>Comprador {c.buyer_name} · Dono {c.seller_name} ({c.seller_claims} reclamação(ões) no total)</span>
      <span>{CLAIM_REASON_LABELS[c.reason]} · pede {CLAIM_REQUEST_LABELS[c.request]}{c.amount ? " de " + formatPrice(c.amount) : ""}</span>
      <span style={{ whiteSpace: "pre-wrap" }}>«{c.description}»</span>
      {c.seller_note && <span>Resposta do dono: {c.seller_note}</span>}
      {c.admin_note && <span>Nota: {c.admin_note}</span>}
      {c.status !== "resolved" && <>
        <label>Decisão e motivo (o comprador e o dono recebem)<textarea rows={2} value={note[c.id] ?? ""} onChange={e => setNote({ ...note, [c.id]: e.target.value })} maxLength={1000} /></label>
        <div className="row">
          <button type="button" disabled={busy} onClick={() => void decide(c, true)}>⚖️ O comprador tem razão</button>
          <button type="button" className="secondary" disabled={busy} onClick={() => void decide(c, false)}>Recusar a reclamação</button>
        </div>
        <small>Se o dono não cumprir a decisão, suspenda a conta em «Utilizadores».</small>
      </>}
    </article>)}
  </section>;
}
