"use client";
import { useEffect, useState } from "react";
import { makeOffer, respondOffer, listOffersFor, validateOffer, offerLabel, parsePrice, friendlyError, OFFER_STATUS_LABELS, type ListingOffer } from "@huambo-online/core";
import { supabase } from "../lib/supabase";

/** Caixa «Fazer proposta» (dinheiro, troca, ou os dois). */
export function OfferBox({ listingId, uid, offerMoney, offerTrade, tradeOnly, tradeWants }: { listingId: string; uid: string | null; offerMoney: boolean; offerTrade: boolean; tradeOnly: boolean; tradeWants?: string | null }) {
  const [amount, setAmount] = useState(""); const [trade, setTrade] = useState(""); const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState(false);
  async function send() {
    if (!uid) { setError("Inicie sessão para fazer uma proposta."); return; }
    const value = amount.trim() ? parsePrice(amount) ?? NaN : undefined;
    const v = validateOffer({ amount: value, tradeItem: trade }, { offerMoney, offerTrade, tradeOnly }); if (v) { setError(v); return; }
    setBusy(true); setError("");
    const r = await makeOffer(supabase(), listingId, { amount: value, tradeItem: offerTrade ? trade : undefined, message }); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else setDone(true);
  }
  if (done) return <section className="card" id="proposta"><p className="ok" role="status" style={{ margin: 0 }}>Proposta enviada! O vendedor vai responder. Acompanhe em <a href="/propostas">As minhas propostas</a>.</p></section>;
  return <section className="card" id="proposta">
    <h2 style={{ margin: 0 }}>{tradeOnly ? "🔁 Propor troca" : offerTrade ? "💬 Fazer proposta ou troca" : "💬 Fazer proposta"}</h2>
    {tradeWants && <p style={{ margin: 0 }}>O vendedor aceita em troca: <strong>{tradeWants}</strong></p>}
    {offerTrade && <label>{tradeOnly ? "O que oferece em troca?" : "O que oferece em troca? (opcional)"}<input value={trade} maxLength={300} onChange={e => setTrade(e.target.value)} placeholder="Ex.: Samsung A10 em bom estado" /></label>}
    {offerMoney && <label>{tradeOnly ? "Dinheiro a mais (Kz, opcional)" : offerTrade ? "Quanto oferece (Kz)" : "Quanto oferece (Kz)"}<input value={amount} inputMode="decimal" onChange={e => setAmount(e.target.value)} placeholder="Ex.: 75 000" /></label>}
    <textarea rows={2} value={message} onChange={e => setMessage(e.target.value)} placeholder="Mensagem para o vendedor (opcional)" />
    {error && <p className="error" role="alert">{error}</p>}
    <button type="button" disabled={busy} onClick={send} style={{ justifySelf: "start" }}>{busy ? "A enviar…" : "Enviar proposta"}</button>
  </section>;
}

/** Propostas recebidas (só o dono do anúncio vê). */
export function OffersList({ listingId }: { listingId: string }) {
  const [items, setItems] = useState<ListingOffer[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listOffersFor(supabase(), listingId); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useEffect(() => { void load(); }, [listingId]);
  async function answer(o: ListingOffer, accept: boolean) {
    const note = prompt(accept ? "Mensagem para o comprador (opcional): onde e quando entregar…" : "Motivo (opcional):") ?? "";
    setError(""); setNotice("");
    const r = await respondOffer(supabase(), o.id, accept, note);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(accept ? "Proposta aceite. O comprador foi avisado." : "Proposta recusada."); await load(); }
  }
  return <section className="card" id="propostas">
    <h2 style={{ margin: 0 }}>💬 Propostas recebidas ({items.filter(o => o.status === "pending").length} à espera)</h2>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items.length === 0 && <p style={{ margin: 0 }}>Ainda não recebeu propostas.</p>}
    {items.map(o => <div key={o.id} className="card" style={{ background: "var(--surface)" }}>
      <strong style={{ fontSize: 19 }}>{offerLabel(o)}</strong>
      <span>De <a href={"/vendedor/" + o.buyer_id}>{o.buyer_name}</a> · {new Date(o.created_at).toLocaleString("pt-AO")} · <span className="badge">{OFFER_STATUS_LABELS[o.status]}</span></span>
      {o.message && <span>💬 {o.message}</span>}
      {o.seller_note && <span>A sua resposta: {o.seller_note}</span>}
      {o.status === "pending" && <div className="row"><button onClick={() => answer(o, true)}>✔ Aceitar</button><button className="danger" onClick={() => answer(o, false)}>✖ Recusar</button></div>}
    </div>)}
  </section>;
}
