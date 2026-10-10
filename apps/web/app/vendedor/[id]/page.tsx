"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getPublicSeller, listSellerListings, listProducts, formatPrice, ratingLabel, friendlyError, PURPOSE_LABELS, type PublicSeller } from "@huambo-online/core";
import { supabase } from "../../../lib/supabase";

export default function Vendedor() {
  const { id } = useParams<{ id: string }>();
  const [s, setS] = useState<PublicSeller | null>(null); const [listings, setListings] = useState<any[]>([]); const [products, setProducts] = useState<any[]>([]); const [error, setError] = useState("");
  useEffect(() => { if (!id) return; void (async () => {
    const c = supabase();
    const r = await getPublicSeller(c, id);
    if (r.error) { setError(friendlyError(r.error)); return; }
    if (!r.data) { setError("Perfil não encontrado."); return; }
    setS(r.data);
    const [l, p] = await Promise.all([listSellerListings(c, id), listProducts(c, { sellerId: id })]);
    setListings(l.data ?? []); setProducts((p.data as any[]) ?? []);
  })(); }, [id]);
  if (error) return <main><a href="/">← Huambo Online</a><p className="error">{error}</p></main>;
  if (!s) return <main><p>A carregar…</p></main>;
  return <main className="stack">
    <a href="/explorar">← Explorar</a>
    <div className="row">
      {s.avatar_url ? <img src={s.avatar_url} alt="" style={{ width: 88, height: 88, borderRadius: "50%", objectFit: "cover" }} /> : <div aria-hidden style={{ width: 88, height: 88, borderRadius: "50%", background: "#ddd" }} />}
      <div><h1 style={{ margin: 0 }}>{s.full_name || "Utilizador"}</h1><p style={{ margin: 0 }}>{[s.municipality, "membro desde " + new Date(s.member_since).toLocaleDateString("pt-AO")].filter(Boolean).join(" · ")}</p></div>
    </div>
    {s.is_provider && <p>{ratingLabel(s.rating, s.review_count)} · <a href={"/profissionais/" + s.id}>Ver perfil profissional →</a></p>}
    <h2>Anúncios ({listings.length})</h2>
    {listings.length === 0 && <p>Sem anúncios publicados.</p>}
    <section className="grid">{listings.map(x => <a key={x.id} href={"/classificados/" + x.id} className="card" style={{ color: "inherit", textDecoration: "none" }}>
      {Array.isArray(x.media) && x.media[0] ? <img className="thumb" src={x.media[0]} alt="" /> : <div className="thumb" />}
      <strong>{x.title}</strong><span className="price">{formatPrice(x.price, x.currency)}</span><span>{PURPOSE_LABELS[x.purpose as keyof typeof PURPOSE_LABELS] ?? x.purpose}</span>
    </a>)}</section>
    {products.length > 0 && <><h2>Produtos na loja ({products.length})</h2>
      <section className="grid">{products.map(p => <a key={p.id} href={"/loja/" + p.id} className="card" style={{ color: "inherit", textDecoration: "none" }}>
        {Array.isArray(p.media) && p.media[0] ? <img className="thumb" src={p.media[0]} alt="" /> : <div className="thumb" />}
        <strong>{p.name}</strong><span className="price">{formatPrice(p.price, p.currency)}</span>
      </a>)}</section></>}
  </main>;
}
