"use client";
import { useEffect, useState } from "react";
import { requestRental, getListingAuction, startListingAuction, bidOnAuction, cancelAuction, nextMinimumBid, timeLeft,
  formatPrice, parsePrice, friendlyError, type ListingAuction } from "@huambo-online/core";
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
      {a.leader_is_me && <span className="ok">Está a ganhar este leilão.</span>}
      <form className="row" onSubmit={e => { e.preventDefault(); if (!uid) { window.location.href = "/conta/login?voltar=" + encodeURIComponent(window.location.pathname); return; } void run(() => bidOnAuction(supabase(), a.id, parsePrice(amount) ?? NaN), "Lance registado."); }}>
        <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder={"Mínimo " + formatPrice(nextMinimumBid(a))} style={{ maxWidth: 240 }} aria-label="Valor do lance" />
        <button disabled={busy}>Licitar</button>
      </form>
    </>}
    {mine && live && a.bid_count === 0 && <button type="button" className="secondary" disabled={busy} onClick={() => { if (confirm("Cancelar o leilão?")) void run(() => cancelAuction(supabase(), a.id), "Leilão cancelado."); }}>Cancelar leilão</button>}
    {error && <p className="error" role="alert">{error}</p>}
    {ok && <p className="ok" role="status">{ok}</p>}
  </section>;
}
