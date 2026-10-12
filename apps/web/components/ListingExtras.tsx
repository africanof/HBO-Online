"use client";
import { useEffect, useState } from "react";
import { requestRental, getListingAuction, startListingAuction, bidOnAuction, cancelAuction, nextMinimumBid, timeLeft,
  formatPrice, parsePrice, friendlyError, listBidsForAuction, retractMyBid, cancelBidAsSeller, canRetractBid, RETRACT_REASON_LABELS,
  type ListingAuction, type AuctionBid, type RetractReason } from "@huambo-online/core";
import { supabase } from "../lib/supabase";

const today = () => new Date().toISOString().slice(0, 10);

/** Pedido de aluguer (anúncios para arrendar/alugar). */
export function RentalRequestForm({ listingId, uid, defaultPrice }: { listingId: string; uid: string | null; defaultPrice?: number | null }) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(""); const [end, setEnd] = useState(""); const [price, setPrice] = useState(defaultPrice != null ? String(defaultPrice) : "");
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [ok, setOk] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) { window.location.href = "/conta/login?voltar=" + encodeURIComponent(window.location.pathname); return; }
    setBusy(true); setError(""); setOk("");
    const r = await requestRental(supabase(), { listingId, startsAt: start, endsAt: end, price: parsePrice(price) ?? 0, message });
    setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setOk("Pedido enviado. Vai ser notificado quando o dono responder."); setOpen(false); }
  }
  if (!open) return <>{ok && <p className="ok" role="status">{ok}</p>}<button type="button" onClick={() => setOpen(true)}>📅 Pedir aluguer</button></>;
  return <form className="card stack" onSubmit={submit}>
    <h2 style={{ margin: 0 }}>Pedir aluguer</h2>
    <label>De<input type="date" min={today()} value={start} onChange={e => setStart(e.target.value)} /></label>
    <label>Até<input type="date" min={start || today()} value={end} onChange={e => setEnd(e.target.value)} /></label>
    <label>Valor proposto (Kz)<input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} /></label>
    <label>Mensagem (opcional)<textarea rows={3} value={message} onChange={e => setMessage(e.target.value)} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="row"><button disabled={busy}>{busy ? "A enviar…" : "Enviar pedido"}</button><button type="button" className="secondary" onClick={() => setOpen(false)}>Cancelar</button></div>
  </form>;
}

/** Leilão do anúncio: ver, licitar, ou (dono) iniciar/cancelar. */
export function AuctionPanel({ listingId, uid, mine, canStart }: { listingId: string; uid: string | null; mine: boolean; canStart: boolean }) {
  const [a, setA] = useState<ListingAuction | null>(null); const [loaded, setLoaded] = useState(false);
  const [amount, setAmount] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [ok, setOk] = useState("");
  const [form, setForm] = useState({ open: false, starting: "", reserve: "", increment: "", days: "7" });
  async function load() { const r = await getListingAuction(supabase(), listingId); setA((r.data as ListingAuction) ?? null); setLoaded(true); }
  useEffect(() => { void load(); }, [listingId]);
  async function run(fn: () => PromiseLike<{ error: any }>, msg: string) {
    setBusy(true); setError(""); setOk("");
    const r = await fn(); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setOk(msg); setAmount(""); await load(); }
  }
  async function placeMax() {
    if (!a) return;
    setBusy(true); setError(""); setOk("");
    const r = await bidOnAuction(supabase(), a.id, parsePrice(amount) ?? NaN);
    if (r.error) { setBusy(false); setError(friendlyError(r.error)); return; }
    const fresh = (await getListingAuction(supabase(), listingId)).data as ListingAuction | null;
    setBusy(false); setAmount(""); if (fresh) setA(fresh);
    setOk(fresh?.leader_is_me ? `Está a ganhar com ${formatPrice(fresh.current_price)}. O sistema licita por si até ${formatPrice(fresh.my_best)}.` : "");
    if (fresh && !fresh.leader_is_me) setError(`Foi ultrapassado de imediato: outra pessoa já tinha um máximo maior. Preço atual: ${formatPrice(fresh.current_price)}.`);
  }
  if (!loaded) return null;
  const live = a && a.status === "live" && new Date(a.ends_at).getTime() > Date.now();

  if (!a || a.status === "cancelled") {
    if (!mine || !canStart) return null;
    if (!form.open) return <button type="button" className="secondary" onClick={() => setForm({ ...form, open: true })}>🔨 Pôr em leilão</button>;
    return <form className="card stack" onSubmit={e => { e.preventDefault(); void run(() => startListingAuction(supabase(), listingId, {
      startingPrice: parsePrice(form.starting) ?? NaN, reservePrice: parsePrice(form.reserve), minIncrement: parsePrice(form.increment), days: Number(form.days) }), "Leilão iniciado."); }}>
      <h2 style={{ margin: 0 }}>Pôr em leilão</h2>
      <label>Preço inicial (Kz)<input inputMode="decimal" value={form.starting} onChange={e => setForm({ ...form, starting: e.target.value })} /></label>
      <label>Preço mínimo de venda (opcional, Kz)<input inputMode="decimal" value={form.reserve} onChange={e => setForm({ ...form, reserve: e.target.value })} /></label>
      <label>Aumento mínimo por lance (Kz)<input inputMode="decimal" value={form.increment} onChange={e => setForm({ ...form, increment: e.target.value })} placeholder="Ex.: 1000" /></label>
      <label>Duração<select value={form.days} onChange={e => setForm({ ...form, days: e.target.value })}>{[1, 3, 5, 7, 10, 14].map(d => <option key={d} value={d}>{d} dia(s)</option>)}</select></label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row"><button disabled={busy}>Iniciar leilão</button><button type="button" className="secondary" onClick={() => setForm({ ...form, open: false })}>Cancelar</button></div>
    </form>;
  }

  return <section className="card stack" aria-label="Leilão">
    <h2 style={{ margin: 0 }}>🔨 Leilão {live ? "a decorrer" : a.status === "scheduled" ? "agendado" : "terminado"}</h2>
    <span className="price">{formatPrice(a.current_price)}</span>
    <span>{a.bid_count} lance(s) · {live ? "termina em " + timeLeft(a.ends_at) : "terminou a " + new Date(a.ends_at).toLocaleString("pt-AO")}{!a.reserve_met && a.bid_count > 0 ? " · preço mínimo ainda não atingido" : ""}</span>
    {a.status === "ended" && <strong>{a.winner_id ? (a.winner_id === uid ? "🎉 Ganhou este leilão. Contacte o vendedor." : "Leilão vendido.") : "Terminou sem vencedor."}</strong>}
    {live && !mine && <>
      {a.leader_is_me ? <span className="ok">✔ Está a ganhar. O seu máximo secreto: <strong>{formatPrice(a.my_best)}</strong>. Pode subi-lo.</span>
        : a.my_best != null ? <span className="error">Foi ultrapassado: outra pessoa tem um máximo maior. Suba o seu máximo para voltar a ganhar.</span> : null}
      <p style={{ margin: 0 }}>💡 Como no eBay: escreva o <strong>máximo</strong> que está disposto a pagar. O Huambo Online licita por si só o necessário para ficar à frente, até esse valor, que ninguém vê.</p>
      <form className="row" onSubmit={e => { e.preventDefault(); if (!uid) { window.location.href = "/conta/login?voltar=" + encodeURIComponent(window.location.pathname); return; } void placeMax(); }}>
        <label style={{ flex: "1 1 220px" }}>{a.leader_is_me ? "Novo máximo (Kz)" : "O seu máximo (Kz)"}
          <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder={"Mínimo " + formatPrice(nextMinimumBid(a))} /></label>
        <button disabled={busy} style={{ alignSelf: "end" }}>{a.leader_is_me ? "Subir máximo" : "Licitar"}</button>
      </form>
    </>}
    {a.status !== "scheduled" && <BidHistory auctionId={a.id} auction={a} mine={mine} uid={uid} version={a.current_price + ":" + a.bid_count} onChanged={(m) => { setOk(m); void load(); }} />}
    {mine && live && a.bid_count === 0 && <button type="button" className="secondary" disabled={busy} onClick={() => { if (confirm("Cancelar o leilão?")) void run(() => cancelAuction(supabase(), a.id), "Leilão cancelado."); }}>Cancelar leilão</button>}
    {error && <p className="error" role="alert">{error}</p>}
    {ok && <p className="ok" role="status">{ok}</p>}
  </section>;
}

/** Lances do leilão: retirar os meus (com motivo) ou, para o vendedor, cancelar os de uma pessoa. */
function BidHistory({ auctionId, auction, mine, uid, version, onChanged }: { auctionId: string; auction: ListingAuction; mine: boolean; uid: string | null; version: string; onChanged: (msg: string) => void }) {
  const [bids, setBids] = useState<AuctionBid[]>([]); const [open, setOpen] = useState(false); const [error, setError] = useState("");
  const [reason, setReason] = useState<RetractReason | "">(""); const [asking, setAsking] = useState(false); const [busy, setBusy] = useState(false);
  async function load() { const r = await listBidsForAuction(supabase(), auctionId); if (!r.error) setBids(r.data); }
  useEffect(() => { void load(); }, [auctionId, version, uid]);
  const live = auction.status === "live" && new Date(auction.ends_at).getTime() > Date.now();
  const myBids = bids.filter(b => b.is_mine);
  const can = canRetractBid(auction, myBids);
  async function retract() {
    if (!reason) { setError("Escolha o motivo."); return; }
    setBusy(true); setError("");
    const r = await retractMyBid(supabase(), auctionId, reason); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setAsking(false); setReason(""); onChanged("Os seus lances foram retirados."); await load(); }
  }
  async function cancel(b: AuctionBid) {
    const why = prompt(`Cancelar todos os lances de ${b.bidder_label}? Escreva o motivo (a pessoa vai ler):`) ?? "";
    if (!why.trim()) return;
    const r = await cancelBidAsSeller(supabase(), b.id, why);
    if (r.error) setError(friendlyError(r.error)); else { onChanged("Lances cancelados. A pessoa não pode voltar a licitar neste leilão."); await load(); }
  }
  if (!bids.length) return null;
  return <div className="stack" style={{ gap: 8 }}>
    <button type="button" className="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Esconder lances" : `Ver lances (${bids.filter(b => !b.retracted).length})`}</button>
    {open && <ol style={{ margin: 0, paddingLeft: 20 }}>{bids.map(b => <li key={b.id} style={{ opacity: b.retracted ? 0.7 : 1 }}>
      <strong>{b.bidder_label}</strong>{b.is_auto ? <small> (automático)</small> : null} · {b.retracted ? <s>{formatPrice(b.amount)}</s> : formatPrice(b.amount)} · <small>{new Date(b.created_at).toLocaleString("pt-AO")}</small>
      {b.retracted && <small> — {b.retracted_by_seller ? "cancelado pelo vendedor" : "retirado"}{b.retract_reason ? ": " + b.retract_reason : ""}</small>}
      {mine && live && !b.retracted && <> <button type="button" className="secondary" onClick={() => cancel(b)}>Cancelar lances</button></>}
    </li>)}</ol>}
    {!mine && live && myBids.some(b => !b.retracted) && (asking
      ? <div className="card stack">
          <strong>Retirar os meus lances</strong>
          <span>Todos os seus lances neste leilão deixam de contar. Só pode fazê-lo 3 vezes em 30 dias.</span>
          <div className="row" role="radiogroup" aria-label="Motivo">{(Object.keys(RETRACT_REASON_LABELS) as RetractReason[]).map(k => <button key={k} type="button" role="radio" aria-checked={reason === k} className={reason === k ? "" : "secondary"} onClick={() => { setReason(k); setError(""); }}>{RETRACT_REASON_LABELS[k]}</button>)}</div>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="row"><button type="button" className="danger" disabled={busy} onClick={retract}>Retirar lances</button><button type="button" className="secondary" onClick={() => setAsking(false)}>Voltar</button></div>
        </div>
      : can.ok ? <button type="button" className="secondary" onClick={() => setAsking(true)}>↩️ Retirar o meu lance</button>
      : <small className="muted">{can.why}</small>)}
    {!asking && error && <p className="error" role="alert">{error}</p>}
  </div>;
}
