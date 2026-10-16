"use client";
import { useEffect, useState } from "react";
import { listMyAuctionBids, groupMyBids, formatPrice, formatRef, timeLeft, friendlyErrorIn, LANG_TAGS, BID_STANDING_LABELS, type MyAuctionBid } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { LiteImg } from "../../components/LiteImg";
import { useT } from "../../lib/i18n";

function Row({ b }: { b: MyAuctionBid }) {
  const { lang, t, tc } = useT();
  const live = b.status === "live" && Date.parse(b.ends_at) > Date.now();
  const tone = b.standing === "winning" || b.standing === "won" ? "ok" : b.standing === "outbid" ? "error" : "";
  return <article className="card" style={{ gridTemplateColumns: "72px minmax(0,1fr)", display: "grid", gap: 12, alignItems: "start" }}>
    {b.photo ? <LiteImg src={b.photo} alt="" width={72} height={72} style={{ objectFit: "cover", borderRadius: 10 }} /> : <span aria-hidden style={{ fontSize: 44, textAlign: "center" }}>🔨</span>}
    <div className="stack" style={{ gap: 4, minWidth: 0 }}>
      <a href={b.listing_id ? "/classificados/" + b.listing_id : "#"} style={{ overflowWrap: "anywhere" }}><strong>{b.title}</strong></a>
      <span className={tone} style={{ margin: 0 }}><strong>{tc(BID_STANDING_LABELS[b.standing])}</strong></span>
      <span>{t("ls.current_price")} <strong>{formatPrice(b.current_price)}</strong>{b.my_max != null && live ? <> · {t("ls.your_max")} <strong>{formatPrice(b.my_max)}</strong></> : null}</span>
      <small className="muted">{t("ls.n_bids", { n: b.bid_count })} · {live ? t("ls.auc_ends_in", { left: tc(timeLeft(b.ends_at)) }) : t("ls.auc_ended_at", { d: new Date(b.ends_at).toLocaleString(LANG_TAGS[lang]) })}{b.ref_no ? " · " + formatRef("listing", b.ref_no) : ""}</small>
      {live && b.standing === "outbid" && b.listing_id && <a className="btn" href={"/classificados/" + b.listing_id} style={{ justifySelf: "start" }}>{t("ls.raise_my_max")}</a>}
      {b.standing === "won" && b.listing_id && <a className="btn secondary" href={"/classificados/" + b.listing_id} style={{ justifySelf: "start" }}>{t("ls.contact_seller")}</a>}
    </div>
  </article>;
}

export default function Licitacoes() {
  const { lang, t } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<MyAuctionBid[]>([]); const [error, setError] = useState("");
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void listMyAuctionBids(supabase()).then(r => { if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }); }); }, []);
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main><h1>{t("ft.my_bids")}</h1><p><a href="/conta/login?voltar=/licitacoes">{t("ls.sign_in")}</a>.</p></main>;
  const g = groupMyBids(items);
  return <main className="stack">
    <a href="/conta">← {t("acct.yours")}</a>
    <h1>🔨 {t("ft.my_bids")}</h1>
    <p style={{ margin: 0 }}>{t("ls.bids_intro")} <a href="/ajuda">{t("ls.how_auctions_work")}</a></p>
    {error && <p className="error" role="alert">{error}</p>}
    {g.needAttention > 0 && <p className="error" role="status">⚠️ {t("ls.outbid_in_n", { n: g.needAttention })}</p>}
    <h2>{t("ls.in_progress_n", { n: g.live.length })}</h2>
    {g.live.length === 0 && <p>{t("ls.no_live_bids")} <a href="/explorar?finalidade=auction">{t("ls.see_auctions")}</a></p>}
    {g.live.map(b => <Row key={b.auction_id} b={b} />)}
    <h2>{t("ls.ended_n", { n: g.ended.length })}</h2>
    {g.ended.length === 0 && <p>{t("ls.nothing_yet")}</p>}
    {g.ended.map(b => <Row key={b.auction_id} b={b} />)}
  </main>;
}
