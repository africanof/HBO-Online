"use client";
import { useEffect, useState } from "react";
import { makeOffer, respondOffer, listOffersFor, validateOffer, offerLabel, parsePrice, friendlyErrorIn, OFFER_STATUS_LABELS, LANG_TAGS, type ListingOffer } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT } from "../lib/i18n";

/** Caixa «Fazer proposta» (dinheiro, troca, ou os dois). */
export function OfferBox({ listingId, uid, offerMoney, offerTrade, tradeOnly, tradeWants }: { listingId: string; uid: string | null; offerMoney: boolean; offerTrade: boolean; tradeOnly: boolean; tradeWants?: string | null }) {
  const { lang, t, tc } = useT();
  const [amount, setAmount] = useState(""); const [trade, setTrade] = useState(""); const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState(false);
  async function send() {
    if (!uid) { setError(t("ls.offer_login")); return; }
    const value = amount.trim() ? parsePrice(amount) ?? NaN : undefined;
    const v = validateOffer({ amount: value, tradeItem: trade }, { offerMoney, offerTrade, tradeOnly }); if (v) { setError(tc(v)); return; }
    setBusy(true); setError("");
    const r = await makeOffer(supabase(), listingId, { amount: value, tradeItem: offerTrade ? trade : undefined, message }); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setDone(true);
  }
  if (done) return <section className="card" id="proposta"><p className="ok" role="status" style={{ margin: 0 }}>{t("ls.offer_sent_a")} <a href="/propostas">{t("acct.l.offers")}</a>{t("ls.offer_sent_b")}</p></section>;
  return <section className="card" id="proposta">
    <h2 style={{ margin: 0 }}>{tradeOnly ? "🔁 " + t("ls.offer_propose_trade") : offerTrade ? "💬 " + t("ls.offer_make_or_trade") : "💬 " + t("ls.offer_make")}</h2>
    {tradeWants && <p style={{ margin: 0 }}>{t("ls.offer_seller_accepts")} <strong>{tradeWants}</strong></p>}
    {offerTrade && <label>{tradeOnly ? t("ls.offer_trade_q") : t("ls.offer_trade_q_opt")}<input value={trade} maxLength={300} onChange={e => setTrade(e.target.value)} placeholder={t("ls.offer_trade_ph")} /></label>}
    {offerMoney && <label>{tradeOnly ? t("ls.offer_extra_money") : t("ls.offer_amount")}<input value={amount} inputMode="decimal" onChange={e => setAmount(e.target.value)} placeholder={t("ls.ex_price")} /></label>}
    <textarea rows={2} value={message} onChange={e => setMessage(e.target.value)} placeholder={t("ls.offer_msg_ph")} />
    {error && <p className="error" role="alert">{error}</p>}
    <button type="button" disabled={busy} onClick={send} style={{ justifySelf: "start" }}>{busy ? t("ls.sending") : t("ls.offer_send")}</button>
  </section>;
}

/** Propostas recebidas (só o dono do anúncio vê). */
export function OffersList({ listingId }: { listingId: string }) {
  const { lang, t, tc } = useT();
  const [items, setItems] = useState<ListingOffer[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listOffersFor(supabase(), listingId); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void load(); }, [listingId]);
  async function answer(o: ListingOffer, accept: boolean) {
    const note = prompt(accept ? t("ls.offer_accept_prompt") : t("ls.reason_opt")) ?? "";
    setError(""); setNotice("");
    const r = await respondOffer(supabase(), o.id, accept, note);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(accept ? t("ls.offer_accepted") : t("ls.offer_declined")); await load(); }
  }
  return <section className="card" id="propostas">
    <h2 style={{ margin: 0 }}>💬 {t("ls.offers_received", { n: items.filter(o => o.status === "pending").length })}</h2>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items.length === 0 && <p style={{ margin: 0 }}>{t("ls.offers_none")}</p>}
    {items.map(o => <div key={o.id} className="card" style={{ background: "var(--surface)" }}>
      <strong style={{ fontSize: 19 }}>{tc(offerLabel(o))}</strong>
      <span>{t("ls.from")} <a href={"/vendedor/" + o.buyer_id}>{o.buyer_name}</a> · {new Date(o.created_at).toLocaleString(LANG_TAGS[lang])} · <span className="badge">{tc(OFFER_STATUS_LABELS[o.status])}</span></span>
      {o.message && <span>💬 {o.message}</span>}
      {o.seller_note && <span>{t("ls.your_reply")} {o.seller_note}</span>}
      {o.status === "pending" && <div className="row"><button onClick={() => answer(o, true)}>✔ {t("ls.accept")}</button><button className="danger" onClick={() => answer(o, false)}>✖ {t("ls.decline")}</button></div>}
    </div>)}
  </section>;
}
