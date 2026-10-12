"use client";
import { useEffect, useState } from "react";
import { listMyAuctionBids, groupMyBids, formatPrice, formatRef, timeLeft, friendlyError, BID_STANDING_LABELS, type MyAuctionBid } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { LiteImg } from "../../components/LiteImg";

function Row({ b }: { b: MyAuctionBid }) {
  const live = b.status === "live" && Date.parse(b.ends_at) > Date.now();
  const tone = b.standing === "winning" || b.standing === "won" ? "ok" : b.standing === "outbid" ? "error" : "";
  return <article className="card" style={{ gridTemplateColumns: "72px minmax(0,1fr)", display: "grid", gap: 12, alignItems: "start" }}>
    {b.photo ? <LiteImg src={b.photo} alt="" width={72} height={72} style={{ objectFit: "cover", borderRadius: 10 }} /> : <span aria-hidden style={{ fontSize: 44, textAlign: "center" }}>🔨</span>}
    <div className="stack" style={{ gap: 4, minWidth: 0 }}>
      <a href={b.listing_id ? "/classificados/" + b.listing_id : "#"} style={{ overflowWrap: "anywhere" }}><strong>{b.title}</strong></a>
      <span className={tone} style={{ margin: 0 }}><strong>{BID_STANDING_LABELS[b.standing]}</strong></span>
      <span>Preço atual: <strong>{formatPrice(b.current_price)}</strong>{b.my_max != null && live ? <> · O seu máximo: <strong>{formatPrice(b.my_max)}</strong></> : null}</span>
      <small className="muted">{b.bid_count} lance(s) · {live ? "termina em " + timeLeft(b.ends_at) : "terminou a " + new Date(b.ends_at).toLocaleString("pt-AO")}{b.ref_no ? " · " + formatRef("listing", b.ref_no) : ""}</small>
      {live && b.standing === "outbid" && b.listing_id && <a className="btn" href={"/classificados/" + b.listing_id} style={{ justifySelf: "start" }}>Subir o meu máximo</a>}
      {b.standing === "won" && b.listing_id && <a className="btn secondary" href={"/classificados/" + b.listing_id} style={{ justifySelf: "start" }}>Contactar o vendedor</a>}
    </div>
  </article>;
}

export default function Licitacoes() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<MyAuctionBid[]>([]); const [error, setError] = useState("");
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void listMyAuctionBids(supabase()).then(r => { if (r.error) setError(friendlyError(r.error)); setItems(r.data); }); }); }, []);
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main><h1>As minhas licitações</h1><p><a href="/conta/login?voltar=/licitacoes">Inicie sessão</a>.</p></main>;
  const g = groupMyBids(items);
  return <main className="stack">
    <a href="/conta">← A sua conta</a>
    <h1>🔨 As minhas licitações</h1>
    <p style={{ margin: 0 }}>Os leilões em que licitou. O seu máximo é secreto: o sistema licita por si até lá. <a href="/ajuda">Como funcionam os leilões</a></p>
    {error && <p className="error" role="alert">{error}</p>}
    {g.needAttention > 0 && <p className="error" role="status">⚠️ Foi ultrapassado em {g.needAttention} leilão(ões) a decorrer.</p>}
    <h2>A decorrer ({g.live.length})</h2>
    {g.live.length === 0 && <p>Não tem licitações em leilões a decorrer. <a href="/explorar?finalidade=auction">Ver leilões</a></p>}
    {g.live.map(b => <Row key={b.auction_id} b={b} />)}
    <h2>Terminados ({g.ended.length})</h2>
    {g.ended.length === 0 && <p>Ainda nada.</p>}
    {g.ended.map(b => <Row key={b.auction_id} b={b} />)}
  </main>;
}
