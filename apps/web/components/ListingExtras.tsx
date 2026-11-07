"use client";
import { useEffect, useState } from "react";
import { requestRental, getListingAuction, startListingAuction, bidOnAuction, cancelAuction, nextMinimumBid, quickBids, timeLeft,
  formatPrice, parsePrice, friendlyErrorIn, LANG_TAGS, buyAuctionNow, listBidsForAuction, retractMyBid, cancelBidAsSeller, canRetractBid, RETRACT_REASON_LABELS,
  type ListingAuction, type AuctionBid, type RetractReason } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { Countdown, withSlot } from "./Countdown";
import { useT } from "../lib/i18n";

const today = () => new Date().toISOString().slice(0, 10);

/** Pedido de aluguer (anúncios para arrendar/alugar). */
export function RentalRequestForm({ listingId, uid, defaultPrice }: { listingId: string; uid: string | null; defaultPrice?: number | null }) {
  const { lang, t } = useT();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(""); const [end, setEnd] = useState(""); const [price, setPrice] = useState(defaultPrice != null ? String(defaultPrice) : "");
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [ok, setOk] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) { window.location.href = "/conta/login?voltar=" + encodeURIComponent(window.location.pathname); return; }
    setBusy(true); setError(""); setOk("");
    const r = await requestRental(supabase(), { listingId, startsAt: start, endsAt: end, price: parsePrice(price) ?? 0, message });
    setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setOk(t("ls.rental_sent")); setOpen(false); }
  }
  if (!open) return <>{ok && <p className="ok" role="status">{ok}</p>}<button type="button" onClick={() => setOpen(true)}>📅 {t("ls.rental_request")}</button></>;
  return <form className="card stack" onSubmit={submit}>
    <h2 style={{ margin: 0 }}>{t("ls.rental_request")}</h2>
    <label>{t("ls.date_from")}<input type="date" min={today()} value={start} onChange={e => setStart(e.target.value)} /></label>
    <label>{t("ls.date_to")}<input type="date" min={start || today()} value={end} onChange={e => setEnd(e.target.value)} /></label>
    <label>{t("ls.rental_total")}<input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} /></label>
    <label>{t("ls.message_opt")}<textarea rows={3} value={message} onChange={e => setMessage(e.target.value)} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="row"><button disabled={busy}>{busy ? t("ls.sending") : t("ls.send_request")}</button><button type="button" className="secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</button></div>
  </form>;
}

/** Leilão do anúncio: ver, licitar, ou (dono) iniciar/cancelar. */
export function AuctionPanel({ listingId, uid, mine, canStart }: { listingId: string; uid: string | null; mine: boolean; canStart: boolean }) {
  const { lang, t, tc } = useT();
  const [a, setA] = useState<ListingAuction | null>(null); const [loaded, setLoaded] = useState(false);
  const [amount, setAmount] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [ok, setOk] = useState("");
  const [form, setForm] = useState({ open: false, starting: "", reserve: "", increment: "", days: "7", buyNow: "" });
  async function load() { const r = await getListingAuction(supabase(), listingId); setA((r.data as ListingAuction) ?? null); setLoaded(true); }
  useEffect(() => { void load(); }, [listingId]);
  async function run(fn: () => PromiseLike<{ error: any }>, msg: string) {
    setBusy(true); setError(""); setOk("");
    const r = await fn(); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setOk(msg); setAmount(""); await load(); }
  }
  async function placeMax() {
    if (!a) return;
    setBusy(true); setError(""); setOk("");
    const r = await bidOnAuction(supabase(), a.id, parsePrice(amount) ?? NaN);
    if (r.error) { setBusy(false); setError(friendlyErrorIn(r.error, lang)); return; }
    const fresh = (await getListingAuction(supabase(), listingId)).data as ListingAuction | null;
    setBusy(false); setAmount(""); if (fresh) setA(fresh);
    setOk(fresh?.leader_is_me ? t("ls.auc_winning_with", { price: formatPrice(fresh.current_price), max: formatPrice(fresh.my_best) }) : "");
    if (fresh && !fresh.leader_is_me) setError(t("ls.auc_outbid_now", { price: formatPrice(fresh.current_price) }));
  }
  if (!loaded) return null;
  const live = a && a.status === "live" && new Date(a.ends_at).getTime() > Date.now();

  if (!a || a.status === "cancelled") {
    if (!mine || !canStart) return null;
    if (!form.open) return <button type="button" className="secondary" onClick={() => setForm({ ...form, open: true })}>🔨 {t("ls.auc_start_title")}</button>;
    return <form className="card stack" onSubmit={e => { e.preventDefault(); void run(() => startListingAuction(supabase(), listingId, {
      startingPrice: parsePrice(form.starting) ?? NaN, reservePrice: parsePrice(form.reserve), minIncrement: parsePrice(form.increment), days: Number(form.days), buyNowPrice: parsePrice(form.buyNow) }), t("ls.auc_started")); }}>
      <h2 style={{ margin: 0 }}>{t("ls.auc_start_title")}</h2>
      <label>{t("ls.auc_start_price")}<input inputMode="decimal" value={form.starting} onChange={e => setForm({ ...form, starting: e.target.value })} /></label>
      <label>{t("ls.auc_reserve")}<input inputMode="decimal" value={form.reserve} onChange={e => setForm({ ...form, reserve: e.target.value })} /></label>
      <label>{t("ls.auc_buy_now_price")}<input inputMode="decimal" value={form.buyNow} onChange={e => setForm({ ...form, buyNow: e.target.value })} /></label>
      <label>{t("ls.auc_increment")}<input inputMode="decimal" value={form.increment} onChange={e => setForm({ ...form, increment: e.target.value })} placeholder={t("ls.ex_1000")} /></label>
      <label>{t("ls.duration")}<select value={form.days} onChange={e => setForm({ ...form, days: e.target.value })}>{[1, 3, 5, 7, 10, 14].map(d => <option key={d} value={d}>{t("ls.n_days_s", { n: d })}</option>)}</select></label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row"><button disabled={busy}>{t("ls.auc_start_btn")}</button><button type="button" className="secondary" onClick={() => setForm({ ...form, open: false })}>{t("common.cancel")}</button></div>
    </form>;
  }

  return <section className="card stack" aria-label={t("purpose.auction")}>
    <h2 style={{ margin: 0 }}>🔨 {live ? t("ls.auc_live") : a.status === "scheduled" ? t("ls.auc_scheduled") : t("ls.auc_ended")}</h2>
    <span className="price">{formatPrice(a.current_price)}</span>
    <span>{t("ls.n_bids", { n: a.bid_count })} · {live ? withSlot(t("ls.auc_ends_in", { left: "\u0000" }), <Countdown endsAt={a.ends_at} onEnd={() => void load()} />) : t("ls.auc_ended_at", { d: new Date(a.ends_at).toLocaleString(LANG_TAGS[lang]) })}{!a.reserve_met && a.bid_count > 0 ? " · " + t("ls.auc_reserve_not_met") : ""}</span>
    {a.status === "ended" && <strong>{a.winner_id ? (a.winner_id === uid ? (a.bought_now ? "🎉 " + t("ls.auc_you_bought") : "🎉 " + t("ls.auc_you_won")) : a.bought_now ? t("ls.auc_sold_buy_now") : t("ls.auc_sold")) : a.has_reserve && a.bid_count > 0 ? t("ls.auc_ended_reserve") : t("ls.auc_no_winner")}</strong>}
    {live && a.buy_now_available && a.buy_now_price != null && (mine
      ? <span>🛒 {t("ls.auc_buy_now_for")} <strong>{formatPrice(a.buy_now_price)}</strong> ({t("ls.auc_buy_now_gone")})</span>
      : <div className="card stack" style={{ gap: 6 }}>
          <span>🛒 {t("ls.auc_dont_wait")} <strong>{formatPrice(a.buy_now_price)}</strong>. {t("ls.auc_gone_first_bid")}</span>
          <button type="button" disabled={busy} onClick={() => { if (!uid) { window.location.href = "/conta/login?voltar=" + encodeURIComponent(window.location.pathname); return; } if (confirm(t("ls.auc_buy_now_confirm", { price: formatPrice(a.buy_now_price) }))) void run(() => buyAuctionNow(supabase(), a.id), t("ls.auc_bought_ok")); }}>🛒 {t("ls.auc_buy_now_btn", { price: formatPrice(a.buy_now_price) })}</button>
        </div>)}
    {live && !mine && <>
      {a.leader_is_me ? <span className="ok">✔ {t("ls.auc_winning")} <strong>{formatPrice(a.my_best)}</strong>. {t("ls.auc_can_raise")}</span>
        : a.my_best != null ? <span className="error">{t("ls.auc_outbid")}</span> : null}
      <p style={{ margin: 0 }}>💡 {t("ls.auc_proxy_help")}</p>
      <form className="stack" style={{ gap: 10 }} onSubmit={e => { e.preventDefault(); if (!uid) { window.location.href = "/conta/login?voltar=" + encodeURIComponent(window.location.pathname); return; } void placeMax(); }}>
        <label>{a.leader_is_me ? t("ls.auc_new_max") : t("ls.auc_your_max")}
          <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder={t("ls.minimum", { price: formatPrice(nextMinimumBid(a)) })} /></label>
        {quickBids(a).length > 0 && <div className="quick-bids" role="group" aria-label={a.leader_is_me ? t("ls.auc_new_max") : t("ls.auc_your_max")}>
          {quickBids(a).map(v => <button key={v} type="button" className={"quick-bid" + (parsePrice(amount) === v ? " on" : "")} aria-pressed={parsePrice(amount) === v} onClick={() => setAmount(String(v))}>{formatPrice(v)}</button>)}
        </div>}
        <button disabled={busy} style={{ width: "100%" }}>{a.leader_is_me ? t("ls.auc_raise_max") : t("ls.auc_bid")}</button>
      </form>
    </>}
    {a.status !== "scheduled" && <BidHistory auctionId={a.id} auction={a} mine={mine} uid={uid} version={a.current_price + ":" + a.bid_count} onChanged={(m) => { setOk(m); void load(); }} />}
    {mine && live && a.bid_count === 0 && <button type="button" className="secondary" disabled={busy} onClick={() => { if (confirm(t("ls.auc_cancel_q"))) void run(() => cancelAuction(supabase(), a.id), t("ls.auc_cancelled")); }}>{t("ls.auc_cancel")}</button>}
    {error && <p className="error" role="alert">{error}</p>}
    {ok && <p className="ok" role="status">{ok}</p>}
  </section>;
}

/** Lances do leilão: retirar os meus (com motivo) ou, para o vendedor, cancelar os de uma pessoa. */
function BidHistory({ auctionId, auction, mine, uid, version, onChanged }: { auctionId: string; auction: ListingAuction; mine: boolean; uid: string | null; version: string; onChanged: (msg: string) => void }) {
  const { lang, t, tc } = useT();
  const [bids, setBids] = useState<AuctionBid[]>([]); const [open, setOpen] = useState(false); const [error, setError] = useState("");
  const [reason, setReason] = useState<RetractReason | "">(""); const [asking, setAsking] = useState(false); const [busy, setBusy] = useState(false);
  async function load() { const r = await listBidsForAuction(supabase(), auctionId); if (!r.error) setBids(r.data); }
  useEffect(() => { void load(); }, [auctionId, version, uid]);
  const live = auction.status === "live" && new Date(auction.ends_at).getTime() > Date.now();
  const myBids = bids.filter(b => b.is_mine);
  const can = canRetractBid(auction, myBids);
  async function retract() {
    if (!reason) { setError(t("ls.pick_reason")); return; }
    setBusy(true); setError("");
    const r = await retractMyBid(supabase(), auctionId, reason); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setAsking(false); setReason(""); onChanged(t("ls.bids_retracted")); await load(); }
  }
  async function cancel(b: AuctionBid) {
    const why = prompt(t("ls.bids_cancel_prompt", { name: tc(b.bidder_label) })) ?? "";
    if (!why.trim()) return;
    const r = await cancelBidAsSeller(supabase(), b.id, why);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { onChanged(t("ls.bids_cancelled")); await load(); }
  }
  if (!bids.length) return null;
  return <div className="stack" style={{ gap: 8 }}>
    <button type="button" className="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? t("ls.bids_hide") : t("ls.bids_show", { n: bids.filter(b => !b.retracted).length })}</button>
    {open && <ol style={{ margin: 0, paddingLeft: 20 }}>{bids.map(b => <li key={b.id} style={{ opacity: b.retracted ? 0.7 : 1 }}>
      <strong>{tc(b.bidder_label)}</strong>{b.is_auto ? <small> ({t("ls.automatic")})</small> : null} · {b.retracted ? <s>{formatPrice(b.amount)}</s> : formatPrice(b.amount)} · <small>{new Date(b.created_at).toLocaleString(LANG_TAGS[lang])}</small>
      {b.retracted && <small> — {b.retracted_by_seller ? t("ls.bid_cancelled_seller") : t("ls.bid_retracted")}{b.retract_reason ? ": " + tc(b.retract_reason) : ""}</small>}
      {mine && live && !b.retracted && <> <button type="button" className="secondary" onClick={() => cancel(b)}>{t("ls.bids_cancel")}</button></>}
    </li>)}</ol>}
    {!mine && live && myBids.some(b => !b.retracted) && (asking
      ? <div className="card stack">
          <strong>{t("ls.bids_retract_title")}</strong>
          <span>{t("ls.bids_retract_text")}</span>
          <div className="row" role="radiogroup" aria-label={t("ls.reason")}>{(Object.keys(RETRACT_REASON_LABELS) as RetractReason[]).map(k => <button key={k} type="button" role="radio" aria-checked={reason === k} className={reason === k ? "" : "secondary"} onClick={() => { setReason(k); setError(""); }}>{tc(RETRACT_REASON_LABELS[k])}</button>)}</div>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="row"><button type="button" className="danger" disabled={busy} onClick={retract}>{t("ls.bids_retract_btn")}</button><button type="button" className="secondary" onClick={() => setAsking(false)}>{t("common.back")}</button></div>
        </div>
      : can.ok ? <button type="button" className="secondary" onClick={() => setAsking(true)}>↩️ {t("ls.bid_retract_mine")}</button>
      : <small className="muted">{tc(can.why)}</small>)}
    {!asking && error && <p className="error" role="alert">{error}</p>}
  </div>;
}
