"use client";
import { useEffect, useState } from "react";
import { searchClassifiedListings, listProducts, listProviders, listMarkets, marketSummary, listWanted, formatPrice, ratingLabel, timeAgo, HOME_CATEGORIES, PURPOSE_LABELS, listingPriceLabel, listTrades, cardSaleTag, loadWithCache, isOfflineError, isFeatured, listEvents, priceFromText, formatEventDate, promoFeed } from "@huambo-online/core";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { ItemCard, LISTING_ICON } from "../components/ItemCard";
import { OfflineBanner } from "../components/Offline";
import { browserStore } from "../components/Engage";
import { LiteImg } from "../components/LiteImg";
import { PromoCard } from "../components/Promo";

type Shelf = { listings: any[]; auctions: any[]; rentals: any[]; products: any[]; providers: any[]; markets: any[]; wanted: any[]; trades?: any[]; events?: any[]; promos?: any[] };

function ShelfHead({ title, href }: { title: string; href: string }) {
  return <div className="shelf-head"><h2>{title}</h2><a href={href}>Ver tudo →</a></div>;
}

export default function Home() {
  const [s, setS] = useState<Shelf | null>(null);
  const [offline, setOffline] = useState<{ on: boolean; at: number | null }>({ on: false, at: null });
  useEffect(() => {
    if (!supabaseConfigured) { setS({ listings: [], auctions: [], rentals: [], products: [], providers: [], markets: [], wanted: [] }); return; }
    const c = supabase();
    // Guarda a página inicial para a mostrar quando a rede falhar.
    void loadWithCache<Shelf>(browserStore, "inicio", async () => {
      const all = await Promise.all([
        searchClassifiedListings(c, { limit: 12 }), searchClassifiedListings(c, { purpose: "auction", limit: 12 }),
        searchClassifiedListings(c, { purpose: "rent", limit: 12 }), listProducts(c, { limit: 12 }), listProviders(c, { limit: 12 }), listMarkets(c), listWanted(c, "", 12), listTrades(c, "", false, 12), listEvents(c, { limit: 12 }), promoFeed(c, { limit: 12 })
      ]);
      const netError = all.map(r => r.error).find(e => isOfflineError(e));
      if (netError) return { data: null, error: netError };
      const [l, a, r, p, v, mk, w, t, ev, pr] = all;
      return { data: {
        listings: (l.data as any[]) ?? [], auctions: (a.data as any[]) ?? [], rentals: (r.data as any[]) ?? [],
        products: (p.data as any[]) ?? [], providers: (v.data as any[]) ?? [], markets: (mk.data as any[]) ?? [], wanted: (w.data as any[]) ?? [], trades: (t.data as any[]) ?? [], events: ((ev.data as any[]) ?? []).filter(e => e.status === "published"), promos: (pr.data as any[]) ?? []
      } };
    }).then(res => {
      setOffline({ on: res.fromCache || isOfflineError(res.error), at: res.savedAt });
      setS(res.data ?? { listings: [], auctions: [], rentals: [], products: [], providers: [], markets: [], wanted: [] });
    });
  }, []);

  const listingCard = (x: any) => <ItemCard key={x.id} featured={isFeatured(x)} video={!!x.video_url} href={"/classificados/" + x.id} media={x.media} title={x.title} price={listingPriceLabel(x)}
    icon={LISTING_ICON[x.listing_type] ?? "🏷️"} tag={x.purpose === "auction" ? "Leilão" : x.purpose !== "sale" ? PURPOSE_LABELS[x.purpose as keyof typeof PURPOSE_LABELS] : cardSaleTag(x)}
    tagRed={x.purpose === "auction"} meta={timeAgo(x.published_at ?? x.created_at)} />;

  return <main>
    <OfflineBanner show={offline.on} savedAt={offline.at} />
    <section className="hero">
      <span className="hero-art" aria-hidden>🛍️</span>
      <h1>Compre, venda e encontre tudo no Huambo.</h1>
      <p>Classificados, loja, leilões, profissionais e empresas — num único lugar, com entrega ao domicílio.</p>
      <div className="row"><a className="btn" href="/explorar">Começar a comprar</a><a className="btn secondary" href="/classificados/publicar">Vender agora</a></div>
    </section>

    <div className="shelf-head"><h2>Explore as categorias</h2></div>
    <nav className="cats" aria-label="Categorias populares" style={{ marginTop: 14 }}>
      {HOME_CATEGORIES.map(c => <a key={c.href} href={c.href} className="cat"><span className="cat-circle" aria-hidden>{c.icon}</span>{c.label}</a>)}
    </nav>

    {s === null && <p className="muted" style={{ marginTop: 28 }}>A carregar novidades…</p>}

    {!!s?.promos?.length && <><ShelfHead title="🎬 Vídeos e lives" href="/videos" /><div className="shelf">{s.promos.map(x => <PromoCard key={x.id} p={x} />)}</div></>}

    {!!s?.events?.length && <><ShelfHead title="🎟️ Próximos eventos" href="/eventos" /><div className="shelf">
      {s.events.map(e => <ItemCard key={e.id} href={"/eventos/" + e.id} media={e.cover_url ? [e.cover_url] : null} icon="🎟️" title={e.title} price={priceFromText(e.price_from)}
        featured={e.featured} meta={`📅 ${formatEventDate(e.starts_at)} · 📍 ${e.venue}`} />)}
    </div></>}

    {!!s?.auctions.length && <><ShelfHead title="🔨 Leilões a decorrer" href="/explorar?finalidade=auction" /><div className="shelf">{s.auctions.map(listingCard)}</div></>}

    {!!s?.markets.length && <><ShelfHead title="🧺 Praças do Huambo" href="/pracas" /><div className="shelf">
      {s.markets.map(m => <a key={m.id} href={"/pracas/" + m.id} className="item">
        <div className="item-img">{m.photo_url ? <LiteImg src={m.photo_url} alt="" loading="lazy" placeholder="🧺" /> : <span aria-hidden>🧺</span>}</div>
        <span className="item-title"><strong>{m.name}</strong></span>
        <span className="item-meta">{marketSummary(m)}</span>
      </a>)}
    </div></>}

    {!!s?.listings.length && <><ShelfHead title="Novidades nos classificados" href="/explorar" /><div className="shelf">{s.listings.map(listingCard)}</div></>}

    {!!s?.wanted.length && <><ShelfHead title="🔎 Procura-se — compradores à procura" href="/procura-se" /><div className="shelf">
      {s.wanted.map(x => <a key={x.id} href={"/classificados/" + x.id} className="card wanted-card">
        <span className="item-meta">🔎 PROCURA-SE</span>
        <strong className="item-title" style={{ fontSize: 17 }}>{x.title}</strong>
        <span className="muted">Orçamento:</span><strong>{listingPriceLabel(x)}</strong>
      </a>)}
    </div></>}

    <section className="banner yellow" style={{ marginTop: 32 }}>
      <div><h2>Tem algo para vender?</h2><p>Publique grátis com fotografias e receba mensagens de compradores do Huambo.</p></div>
      <div className="row"><a className="btn" href="/classificados/publicar">+ Publicar anúncio</a><a className="btn secondary" href="/classificados/publicar?finalidade=wanted">🔎 Publicar o que procuro</a></div>
    </section>

    {!!s?.products.length && <><ShelfHead title="🛍️ Na loja" href="/loja" /><div className="shelf">
      {s.products.map(p => <ItemCard key={p.id} href={"/loja/" + p.id} media={p.media} title={p.name} price={formatPrice(p.price, p.currency)}
        meta={p.stock > 0 ? [p.seller_name, p.municipality_name].filter(Boolean).join(" · ") : "Esgotado"} tag={p.stock > 0 ? undefined : "Esgotado"} />)}
    </div></>}

    {!!s?.rentals.length && <><ShelfHead title="🔑 Para arrendar" href="/explorar?finalidade=rent" /><div className="shelf">{s.rentals.map(listingCard)}</div></>}
    {!!s?.trades?.length && <><ShelfHead title="🔁 Trocas" href="/trocas" /><div className="shelf">{s.trades.map(listingCard)}</div></>}

    {!!s?.providers.length && <><ShelfHead title="👷 Profissionais de confiança" href="/profissionais" /><div className="shelf">
      {s.providers.map(p => <a key={p.user_id} href={"/profissionais/" + p.user_id} className="card" style={{ color: "inherit", textDecoration: "none", fontWeight: 400 }}>
        {p.avatar_url ? <LiteImg placeholder="👤" src={p.avatar_url} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }} /> : <span style={{ fontSize: 40 }} aria-hidden>👷</span>}
        <strong>{p.display_name}{p.verified ? " ✔️" : ""}</strong>
        <span className="item-meta">{[p.category_name, p.municipality_name].filter(Boolean).join(" · ")}</span>
        <span className="item-meta">{ratingLabel(p.rating, p.review_count)}</span>
      </a>)}
    </div></>}

    {s && !s.listings.length && !s.products.length && <section className="card" style={{ marginTop: 28 }}>
      <h2 style={{ margin: 0 }}>Seja o primeiro a anunciar!</h2>
      <p style={{ margin: 0 }}>Ainda há poucos artigos. Publique o seu e ajude o Huambo Online a crescer.</p>
      <a className="btn" href="/classificados/publicar" style={{ justifySelf: "start" }}>Publicar anúncio</a>
    </section>}

    <section className="banner green" style={{ marginTop: 32 }}>
      <div><h2>Profissional, empresa ou estafeta?</h2><p>Crie o seu perfil e receba clientes de todo o Huambo.</p></div>
      <div className="row"><a className="btn secondary" href="/conta/profissional">Sou profissional</a><a className="btn secondary" href="/conta/empresas">Tenho uma empresa</a><a className="btn secondary" href="/entregas">Quero ser estafeta</a></div>
    </section>
  </main>;
}
