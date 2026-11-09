"use client";
import { useEffect, useState } from "react";
import { listMyOffers, withdrawOffer, acceptCounterOffer, formatPrice, offerLabel, friendlyErrorIn, LANG_TAGS, OFFER_STATUS_LABELS, type MyOffer } from "@huambo-online/core";
import { currentUserId, supabase } from "../../lib/supabase";
import { useT } from "../../lib/i18n";

export default function Propostas() {
  const { lang, t, tc } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<MyOffer[] | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listMyOffers(supabase()); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []);
  async function withdraw(id: string) {
    if (!confirm(t("ls.withdraw_offer_q"))) return;
    const r = await withdrawOffer(supabase(), id);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("ls.offer_withdrawn")); await load(); }
  }
  async function acceptCounter(o: MyOffer) {
    setError(""); const r = await acceptCounterOffer(supabase(), o.id);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else window.location.href = "/classificados/" + o.listing_id + "#comprar";
  }
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main><a href="/">← Huambo Online</a><h1>{t("acct.l.offers")}</h1><p><a href="/conta/login?voltar=/propostas">{t("ls.sign_in")}</a>.</p></main>;
  return <main className="stack">
    <a href="/conta">← {t("acct.yours")}</a>
    <h1>💬 {t("acct.l.offers")}</h1>
    <p>{t("ls.my_offers_intro")}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items === null && !error && <p>{t("common.loading")}</p>}
    {items?.length === 0 && <p>{t("ls.my_offers_empty")}</p>}
    {items?.map(o => <article key={o.id} className="card">
      <strong style={{ fontSize: 19 }}><a href={"/classificados/" + o.listing_id}>{o.listing_title}</a></strong>
      <span>{t("ls.you_offered")} <strong>{tc(offerLabel(o))}</strong> · <span className="badge">{tc(OFFER_STATUS_LABELS[o.status])}</span></span>
      {o.seller_note && <span>{t("ls.seller_reply")} {o.seller_note}</span>}
      <small>{new Date(o.created_at).toLocaleString(LANG_TAGS[lang])}</small>
      {o.status === "countered" && o.counter_amount != null && <div className="card stack" style={{ borderColor: "var(--accent)", gap: 8 }}>
        <strong>{t("off.counter_from_seller", { amount: formatPrice(o.counter_amount, o.currency ?? "AOA") })}</strong>
        <div className="row"><button onClick={() => acceptCounter(o)}>{t("off.accept_counter", { amount: formatPrice(o.counter_amount, o.currency ?? "AOA") })}</button><button className="secondary" onClick={() => withdraw(o.id)}>{t("off.decline_counter")}</button></div>
      </div>}
      {o.status === "accepted" && o.listing_status === "published" && <a className="btn" style={{ justifySelf: "start" }} href={"/classificados/" + o.listing_id + "#comprar"}>{t("pay.pay_now")}</a>}
      {o.status === "pending" && <button className="secondary" style={{ justifySelf: "start" }} onClick={() => withdraw(o.id)}>{t("ls.withdraw_offer")}</button>}
    </article>)}
  </main>;
}
