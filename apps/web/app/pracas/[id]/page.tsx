"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getMarket, listMarketContents, formatPrice, friendlyError, timeAgo, PURPOSE_LABELS } from "@huambo-online/core";
import { supabase } from "../../../lib/supabase";
import { ItemCard, LISTING_ICON } from "../../../components/ItemCard";

type Tab = "products" | "listings" | "businesses";

export default function Praca() {
  const { id } = useParams<{ id: string }>();
  const [m, setM] = useState<any>(null); const [c, setC] = useState<{ listings: any[]; products: any[]; businesses: any[] } | null>(null);
  const [tab, setTab] = useState<Tab>("products"); const [error, setError] = useState("");
  useEffect(() => { if (!id) return; void (async () => {
    const s = supabase();
    const r = await getMarket(s, id);
    if (r.error) { setError(friendlyError(r.error)); return; }
    if (!r.data) { setError("Praça não encontrada."); return; }
    setM(r.data);
    const x = await listMarketContents(s, id); setC(x);
    if (!x.products.length && x.listings.length) setTab("listings"); else if (!x.products.length && !x.listings.length && x.businesses.length) setTab("businesses");
  })(); }, [id]);
  if (error) return <main><a href="/pracas">← Praças</a><p className="error">{error}</p></main>;
  if (!m) return <main><p>A carregar…</p></main>;
  const tabs: [Tab, string, number][] = [["products", "Produtos", c?.products.length ?? 0], ["listings", "Anúncios", c?.listings.length ?? 0], ["businesses", "Lojas e bancas", c?.businesses.length ?? 0]];
  return <main className="stack">
    <a href="/pracas">← Praças</a>
    <div className="itempage" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(280px,1fr)" }}>
      <div className="gallery-empty" style={{ aspectRatio: "16/9", gridColumn: "auto", overflow: "hidden" }}>{m.photo_url ? <img src={m.photo_url} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🧺"}</div>
      <section className="buybox">
        <h1>{m.name}</h1>
        <dl className="facts">
          <dt>Local</dt><dd>📍 {[m.address_text, m.municipalities?.name].filter(Boolean).join(", ") || "Huambo"}</dd>
          {m.opening_hours && <><dt>Horário</dt><dd>🕘 {m.opening_hours}</dd></>}
        </dl>
        {m.description && <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{m.description}</p>}
        <div className="banner green" style={{ padding: 16 }}>
          <div><strong>Vende nesta praça?</strong><p>Ao publicar um anúncio ou produto, escolha «{m.name}» no campo «Praça».</p></div>
          <div className="row"><a className="btn" href="/classificados/publicar">Publicar anúncio</a><a className="btn secondary" href="/conta/produtos">Vender produtos</a></div>
        </div>
      </section>
    </div>
    <nav className="row" role="tablist">{tabs.map(([t, l, n]) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{l} ({n})</button>)}</nav>
    {c === null && <p>A carregar…</p>}
    {c && tab === "products" && (c.products.length ? <div className="results-grid">{c.products.map(p => <ItemCard key={p.id} href={"/loja/" + p.id} media={p.media} title={p.name} price={formatPrice(p.price, p.currency)} meta={p.stock > 0 ? `${p.stock} em stock` : "Esgotado"} />)}</div> : <p>Ainda não há produtos desta praça.</p>)}
    {c && tab === "listings" && (c.listings.length ? <div className="results-grid">{c.listings.map(x => <ItemCard key={x.id} href={"/classificados/" + x.id} media={x.media} title={x.title} price={formatPrice(x.price, x.currency)} icon={LISTING_ICON[x.listing_type] ?? "🏷️"} meta={[PURPOSE_LABELS[x.purpose as keyof typeof PURPOSE_LABELS], timeAgo(x.created_at)].filter(Boolean).join(" · ")} />)}</div> : <p>Ainda não há anúncios desta praça.</p>)}
    {c && tab === "businesses" && (c.businesses.length ? <section className="grid">{c.businesses.map(b => <a key={b.id} href={"/empresas/" + b.id} className="card" style={{ color: "inherit", textDecoration: "none", fontWeight: 400 }}>
      <strong style={{ fontSize: 19 }}>{b.name}{b.verified ? " ✔️" : ""}</strong>{b.description && <span className="item-meta">{String(b.description).slice(0, 120)}</span>}</a>)}</section> : <p>Ainda não há lojas registadas nesta praça. <a href="/conta/empresas">Registe a sua banca ou loja →</a></p>)}
  </main>;
}
