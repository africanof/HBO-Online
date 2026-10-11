"use client";
import { useEffect, useState } from "react";
import { Gallery } from "../../../components/Video";
import { useParams } from "next/navigation";
import { getProduct, addToMyCart, getPublicProfile, formatPrice, friendlyError } from "@huambo-online/core";
import { supabase } from "../../../lib/supabase";
import { SaveButton, ShareButton, useRecordView } from "../../../components/Engage";
import { SellerBadge } from "../../../components/Reputation";
import { ReportButton } from "../../../components/Trust";

export default function Produto() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<any>(null); const [seller, setSeller] = useState(""); const [uid, setUid] = useState<string | null>(null);
  const [qty, setQty] = useState(1); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!id) return; void (async () => {
    const c = supabase(); const r = await getProduct(c, id);
    if (r.error) { setError(friendlyError(r.error)); return; }
    if (!r.data) { setError("Produto não encontrado."); return; }
    setP(r.data);
    const s = await getPublicProfile(c, r.data.seller_id); if (s.data?.full_name) setSeller(s.data.full_name);
    const u = await c.auth.getUser(); setUid(u.data.user?.id ?? null);
  })(); }, [id]);
  useRecordView("product", p ? id : undefined, p?.name, Array.isArray(p?.media) ? p.media[0] : null);

  async function add() {
    if (!uid) { window.location.href = "/conta/login?voltar=/loja/" + id; return; }
    setBusy(true); setError(""); setNotice("");
    const r = await addToMyCart(supabase(), id, qty); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else setNotice("Adicionado ao carrinho.");
  }
  if (error && !p) return <main><a href="/loja">← Loja</a><p className="error">{error}</p></main>;
  if (!p) return <main><p>A carregar…</p></main>;
  const media: string[] = Array.isArray(p.media) ? p.media : [];
  const mine = uid === p.seller_id;
  return <main className="stack">
    <a href="/loja">← Loja{p.categories?.name ? " › " + p.categories.name : ""}</a>
    <div className="itempage">
      <Gallery media={media} video={p.video_url} icon={"📦"} title={p.name} />
      <section className="buybox">
        <h1>{p.name}</h1>
        {seller && <div className="seller-box"><span aria-hidden style={{ fontSize: 30 }}>🏪</span><span>Vendedor: <a href={"/vendedor/" + p.seller_id}><strong>{seller}</strong></a> <SellerBadge userId={p.seller_id} /><br /><a href={"/vendedor/" + p.seller_id} style={{ fontWeight: 400, fontSize: 15 }}>Ver a loja do vendedor</a></span></div>}
        <div className="big-price">{formatPrice(p.price, p.currency)}</div>
        <dl className="facts">
          <dt>Disponível</dt><dd style={{ color: p.stock > 0 ? "var(--ok)" : "var(--danger)" }}>{p.stock > 0 ? `${p.stock} em stock` : "Esgotado"}</dd>
          {p.categories?.name && <><dt>Categoria</dt><dd>{p.categories.name}</dd></>}
          {p.municipalities?.name && <><dt>Local</dt><dd>📍 {p.municipalities.name}</dd></>}
          {p.markets?.name && <><dt>Praça</dt><dd>🧺 <a href={"/pracas/" + p.markets.id}>{p.markets.name}</a></dd></>}
          <dt>Entrega</dt><dd>🛵 Ao domicílio ou levantar</dd>
        </dl>
        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="ok" role="status">{notice} <a href="/carrinho">Ver carrinho →</a></p>}
        <div className="actions">
          {mine ? <a className="btn" href="/conta/produtos">Gerir os meus produtos</a> : p.stock > 0 && <>
            <label style={{ maxWidth: 160 }}>Quantidade<input type="number" min={1} max={p.stock} value={qty} onChange={e => setQty(Math.max(1, Math.min(p.stock, Number(e.target.value) || 1)))} /></label>
            <button disabled={busy} onClick={add}>🛒 Adicionar ao carrinho</button>
          </>}
          {!mine && <SaveButton kind="product" id={id} />}
          <ShareButton kind="product" id={id} title={p.name} />
        </div>
      </section>
    </div>
    {p.description && <section className="card"><h2 style={{ margin: 0 }}>Descrição</h2><p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{p.description}</p></section>}
    {!mine && <ReportButton type="product" id={id} label="Denunciar este produto" />}
  </main>;
}
