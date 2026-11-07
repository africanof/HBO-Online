"use client";
import { useEffect, useRef, useState } from "react";
import { chatPaymentState, requestChatPayment, formatPrice, friendlyErrorIn, parsePrice, orderHref, type ChatPaymentCard } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ProtectedBuyBox } from "./ProtectedBuy";
import { useT, eventDateIn } from "../lib/i18n";

/** Quem vende: «💳 Pedir pagamento» com o preço combinado (até ao preço do anúncio). */
export function ChatPayAsk({ conversationId, listing, onSent, onClose }: { conversationId: string; listing: { price: number | null; currency: string | null }; onSent: () => void; onClose: () => void }) {
  const { t, lang } = useT();
  const [amount, setAmount] = useState(listing.price ? String(Math.round(Number(listing.price))) : ""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function send() {
    setError(""); const v = parsePrice(amount);
    if (!v || v <= 0) { setError(t("pay.amount")); return; }
    setBusy(true); const r = await requestChatPayment(supabase(), conversationId, v); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else onSent();
  }
  return <form className="chat-pay-ask card stack" onSubmit={e => { e.preventDefault(); void send(); }}>
    <strong>{t("pay.ask_title")}</strong>
    <small className="muted">{t("pay.ask_hint", { price: listing.price ? formatPrice(listing.price, listing.currency ?? "AOA") : "—" })}</small>
    <label>{t("pay.amount")}<input inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} required /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="row"><button type="submit" disabled={busy}>{busy ? t("common.loading") : t("pay.send")}</button><button type="button" className="secondary" onClick={onClose}>{t("common.cancel")}</button></div>
  </form>;
}

/** Cartão do pedido de pagamento dentro da conversa (os dois lados veem o estado). */
export function ChatPayCard({ card, uid }: { card: ChatPaymentCard; uid: string }) {
  const { t, lang } = useT(); const [paying, setPaying] = useState(false); const box = useRef<HTMLDivElement>(null);
  // Ao abrir o formulário, mostra-o todo (fica dentro da lista de mensagens).
  useEffect(() => { if (paying) setTimeout(() => box.current?.scrollIntoView({ block: "end", behavior: "smooth" }), 50); }, [paying]);
  const st = chatPaymentState(card); const amount = formatPrice(card.amount, card.currency);
  const item = { id: card.listing_id, status: card.listing_status, purpose: card.purpose, price: card.amount, currency: card.currency, title: card.title };
  return <div ref={box} className={"chat-pay-card st-" + st}>
    <div className="chat-pay-head">
      {card.photo ? <img src={card.photo} alt="" loading="lazy" /> : <span aria-hidden>🛡️</span>}
      <div><small>{t("pay.card_title")}</small><strong>{card.title}</strong><span className="chat-pay-amount">{amount}</span>
        {card.listing_price && card.listing_price > card.amount ? <small className="muted"><s>{t("pay.was", { price: formatPrice(card.listing_price, card.currency) })}</s></small> : null}</div>
    </div>
    {st === "pay" && !paying && <><button type="button" onClick={() => setPaying(true)}>{t("pay.pay", { amount })}</button><small className="muted">{t("pay.st.pay", { date: eventDateIn(card.expires_at, lang) })}</small></>}
    {st === "pay" && paying && <ProtectedBuyBox item={item} uid={uid} isJob={false} startOpen onCancel={() => setPaying(false)} />}
    {st === "waiting_buyer" && <small>{t("pay.st.waiting_buyer", { date: eventDateIn(card.expires_at, lang) })}</small>}
    {st !== "pay" && st !== "waiting_buyer" && <small>{t("pay.st." + st)}</small>}
    {card.is_buyer && card.order_id && st === "awaiting_payment" && <a className="btn" href={orderHref(card.order_id, true)}>{t("pay.pay_now")}</a>}
    {card.is_buyer && card.order_id && (st === "held" || st === "released") && <a href={orderHref(card.order_id)}>{t("pay.see_order")}</a>}
  </div>;
}
