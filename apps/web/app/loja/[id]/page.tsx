"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getProduct, addToMyCart, getPublicProfile, formatPrice, friendlyError } from "@huambo-online/core";
import { supabase } from "../../../lib/supabase";

export default function Produto() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<any>(null); const [seller, setSeller] = useState(""); const [uid, setUid] = useState<string | null>(null);
  const [qty, setQty] = useState(1); const [photo, setPhoto] = useState(0); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!id) return; void (async () => {
    const c = supabase(); const r = await getProduct(c, id);
    if (r.error) { setError(friendlyError(r.error)); return; }
    if (!r.data) { setError("Produto não encontrado."); return; }
    setP(r.data);
    const s = await getPublicProfile(c, r.data.seller_id); if (s.data?.full_name) setSeller(s.data.full_name);
    const u = await c.auth.getUser(); setUid(u.data.user?.id ?? null);
  })(); }, [id]);
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
    <a href="/loja">← Loja</a>
    <h1>{p.name}</h1>
    <p className="price">{formatPrice(p.price, p.currency)}</p>
    <p>{p.stock > 0 ? `${p.stock} em stock` : "Esgotado"} · {[p.categories?.name, p.municipalities?.name].filter(Boolean).join(" · ")}</p>
    {seller && <p>Vendedor: <strong>{seller}</strong></p>}
    {media.length > 0 && <section className="stack">
      <img src={media[photo]} alt={`Fotografia ${photo + 1}`} style={{ width: "100%", maxHeight: 480, objectFit: "contain", background: "#f2f2f2", borderRadius: 12 }} />
      {media.length > 1 && <div className="row">{media.map((m, i) => <button key={m} type="button" className={i === photo ? "" : "secondary"} onClick={() => setPhoto(i)} style={{ padding: 0, width: 72, height: 72, overflow: "hidden" }} aria-label={`Fotografia ${i + 1}`}><img src={m} alt="" style={{ width: 72, height: 72, objectFit: "cover" }} /></button>)}</div>}
    </section>}
    {p.description && <p style={{ whiteSpace: "pre-wrap" }}>{p.description}</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice} <a href="/carrinho">Ver carrinho →</a></p>}
    {mine ? <a className="btn" href="/conta/produtos">Gerir os meus produtos</a> : p.stock > 0 && <div className="row">
      <label style={{ maxWidth: 140 }}>Quantidade<input type="number" min={1} max={p.stock} value={qty} onChange={e => setQty(Math.max(1, Math.min(p.stock, Number(e.target.value) || 1)))} /></label>
      <button disabled={busy} onClick={add} style={{ alignSelf: "end" }}>🛒 Adicionar ao carrinho</button>
    </div>}
  </main>;
}
