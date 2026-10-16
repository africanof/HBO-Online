"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getMarket, listMarketContents, formatPrice, friendlyErrorIn, PURPOSE_LABELS, listingPriceLabel, isFeatured } from "@huambo-online/core";
import { useT, timeAgoIn } from "../../../lib/i18n";
import { supabase } from "../../../lib/supabase";
import { ItemCard, LISTING_ICON } from "../../../components/ItemCard";

type Tab = "products" | "listings" | "businesses";

export default function Praca() {
  const { lang, t, tc } = useT();
  const { id } = useParams<{ id: string }>();
  const [m, setM] = useState<any>(null); const [c, setC] = useState<{ listings: any[]; products: any[]; businesses: any[] } | null>(null);
  const [tab, setTab] = useState<Tab>("products"); const [error, setError] = useState("");
  useEffect(() => { if (!id) return; void (async () => {
    const s = supabase();
    const r = await getMarket(s, id);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    if (!r.data) { setError(t("sv.mk_not_found")); return; }
    setM(r.data);
    const x = await listMarketContents(s, id); setC(x);
    if (!x.products.length && x.listings.length) setTab("listings"); else if (!x.products.length && !x.listings.length && x.businesses.length) setTab("businesses");
  })(); }, [id]);
  if (error) return <main><a href="/pracas">← {t("nav.markets")}</a><p className="error">{error}</p></main>;
  if (!m) return <main><p>{t("common.loading")}</p></main>;
  const tabs: [Tab, string, number][] = [["products", t("sv.mk_products"), c?.products.length ?? 0], ["listings", t("sv.mk_listings"), c?.listings.length ?? 0], ["businesses", t("sv.mk_shops"), c?.businesses.length ?? 0]];
  return <main className="stack">
    <a href="/pracas">← {t("nav.markets")}</a>
    <div className="itempage" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(280px,1fr)" }}>
      <div className="gallery-empty" style={{ aspectRatio: "16/9", gridColumn: "auto", overflow: "hidden" }}>{m.photo_url ? <img src={m.photo_url} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🧺"}</div>
      <section className="buybox">
        <h1>{m.name}</h1>
        <dl className="facts">
          <dt>{t("sv.mk_place")}</dt><dd>📍 {[m.address_text, m.municipalities?.name].filter(Boolean).join(", ") || "Huambo"}</dd>
          {m.opening_hours && <><dt>{t("sv.mk_hours")}</dt><dd>🕘 {m.opening_hours}</dd></>}
        </dl>
        {m.description && <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{m.description}</p>}
        <div className="banner green" style={{ padding: 16 }}>
          <div><strong>{t("sv.mk_sell_here")}</strong><p>{t("sv.mk_sell_hint", { name: m.name })}</p></div>
          <div className="row"><a className="btn" href="/classificados/publicar">{t("sv.mk_post")}</a><a className="btn secondary" href="/conta/produtos">{t("sv.mk_sell_products")}</a></div>
        </div>
        <p style={{ margin: 0 }}>🤝 {t("sv.mk_agent_a")} <a href="/agente">{t("sv.mk_agent_link")}</a> {t("sv.mk_agent_b")}</p>
      </section>
    </div>
    <nav className="row" role="tablist">{tabs.map(([t, l, n]) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{l} ({n})</button>)}</nav>
    {c === null && <p>{t("common.loading")}</p>}
    {c && tab === "products" && (c.products.length ? <div className="results-grid">{c.products.map(p => <ItemCard key={p.id} video={!!p.video_url} href={"/loja/" + p.id} media={p.media} title={p.name} price={formatPrice(p.price, p.currency)} meta={p.stock > 0 ? t("sv.mk_in_stock", { n: p.stock }) : t("sv.mk_sold_out")} />)}</div> : <p>{t("sv.mk_no_products")}</p>)}
    {c && tab === "listings" && (c.listings.length ? <div className="results-grid">{c.listings.map(x => <ItemCard key={x.id} featured={isFeatured(x)} video={!!x.video_url} href={"/classificados/" + x.id} media={x.media} title={x.title} price={tc(listingPriceLabel(x))} icon={LISTING_ICON[x.listing_type] ?? "🏷️"} meta={[tc(PURPOSE_LABELS[x.purpose as keyof typeof PURPOSE_LABELS]), timeAgoIn(x.created_at, lang)].filter(Boolean).join(" · ")} />)}</div> : <p>{t("sv.mk_no_listings")}</p>)}
    {c && tab === "businesses" && (c.businesses.length ? <section className="grid">{c.businesses.map(b => <a key={b.id} href={"/empresas/" + b.id} className="card" style={{ color: "inherit", textDecoration: "none", fontWeight: 400 }}>
      <strong style={{ fontSize: 19 }}>{b.name}{b.verified ? " ✔️" : ""}</strong>{b.description && <span className="item-meta">{String(b.description).slice(0, 120)}</span>}</a>)}</section> : <p>{t("sv.mk_no_shops")} <a href="/conta/empresas">{t("sv.mk_register_shop")} →</a></p>)}
  </main>;
}
