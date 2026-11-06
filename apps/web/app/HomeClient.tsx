"use client";
import { useEffect, useState } from "react";
import { searchClassifiedListings, listProducts, listProviders, listMarkets, listWanted, formatPrice, ratingLabel, HOME_CATEGORIES, listingPriceLabel, listTrades, cardSaleTag, loadWithCache, isOfflineError, isFeatured, listEvents, priceFromText, promoFeed, categoryLabelIn } from "@huambo-online/core";
import { useT, timeAgoIn, eventDateIn, marketSummaryIn } from "../lib/i18n";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { ItemCard, LISTING_ICON } from "../components/ItemCard";
import { OfflineBanner } from "../components/Offline";
import { browserStore } from "../components/Engage";
import { LiteImg } from "../components/LiteImg";
import { PromoCard } from "../components/Promo";
import { recommendedListings, HUAMBO_MUNICIPALITIES } from "@huambo-online/core";

type Shelf = { listings: any[]; auctions: any[]; rentals: any[]; products: any[]; providers: any[]; markets: any[]; wanted: any[]; trades?: any[]; events?: any[]; promos?: any[] };

function ShelfHead({ title, href }: { title: string; href: string }) {
  const { t } = useT();
  return <div className="shelf-head"><h2>{title}</h2><a href={href}>{t("common.see_all")} →</a></div>;
}

/** Página inicial (no navegador). «initialListings» vem do servidor: os anúncios mais recentes aparecem logo e o Google vê-os. */
export function HomeClient({ initialListings }: { initialListings?: any[] | null }) {
  const { lang, t } = useT();
  // «Sem avaliações» vem do core em português; as estrelas e números não precisam de tradução.
  const rating = (r: unknown, n: unknown) => { const l = ratingLabel(r as number, n as number); return l === "Sem avaliações" ? t("rating.none") : l; };
  const [s, setS] = useState<Shelf | null>(initialListings?.length ? { listings: initialListings, auctions: [], rentals: [], products: [], providers: [], markets: [], wanted: [] } : null);
  const [offline, setOffline] = useState<{ on: boolean; at: number | null }>({ on: false, at: null });
  // «Para si»: só com sessão iniciada (com base no que a pessoa viu, pesquisou e guardou).
  const [recs, setRecs] = useState<any[]>([]);
  useEffect(() => {
    if (!supabaseConfigured) return;
    const c = supabase();
    void c.auth.getUser().then(({ data }) => { if (data.user) void recommendedListings(c, 12).then(r => setRecs(r.data)); });
  }, []);
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

  const listingCard = (x: any) => <ItemCard save={{ kind: "listing", id: x.id }} key={x.id} featured={isFeatured(x)} video={!!x.video_url} href={"/classificados/" + x.id} media={x.media} title={x.title} price={listingPriceLabel(x)}
    icon={LISTING_ICON[x.listing_type] ?? "🏷️"} tag={x.purpose === "auction" ? t("purpose.auction") : x.purpose !== "sale" ? t("purpose." + x.purpose) : cardSaleTag(x)}
    tagRed={x.purpose === "auction"} meta={timeAgoIn(x.published_at ?? x.created_at, lang)} />;

  return <main>
    <OfflineBanner show={offline.on} savedAt={offline.at} />
    <section className="hero">
      <span className="hero-art" aria-hidden>🛍️</span>
      <h1>{t("home.hero_title")}</h1>
      <p>{t("home.hero_text")}</p>
      <div className="row"><a className="btn" href="/explorar">{t("home.start_buying")}</a><a className="btn secondary" href="/classificados/publicar">{t("home.sell_now")}</a></div>
    </section>

    <div className="shelf-head"><h2>{t("home.explore_cats")}</h2></div>
    <nav className="cats" aria-label={t("home.popular_cats")} style={{ marginTop: 14 }}>
      {HOME_CATEGORIES.map(c => <a key={c.href} href={c.href} className="cat"><span className="cat-circle" aria-hidden>{c.icon}</span>{categoryLabelIn(c.label, lang)}</a>)}
    </nav>

    {s === null && <p className="muted" style={{ marginTop: 28 }}>{t("home.loading")}</p>}

    {!!recs.length && <><ShelfHead title={"✨ " + t("home.for_you")} href="/explorar" /><div className="shelf">{recs.map(listingCard)}</div></>}

    {!!s?.promos?.length && <><ShelfHead title={"🎬 " + t("home.videos")} href="/videos" /><div className="shelf">{s.promos.map(x => <PromoCard key={x.id} p={x} />)}</div></>}

    {!!s?.events?.length && <><ShelfHead title={"🎟️ " + t("home.events")} href="/eventos" /><div className="shelf">
      {s.events.map(e => <ItemCard key={e.id} href={"/eventos/" + e.id} media={e.cover_url ? [e.cover_url] : null} icon="🎟️" title={e.title} price={priceFromText(e.price_from)}
        featured={e.featured} meta={`📅 ${eventDateIn(e.starts_at, lang)} · 📍 ${e.venue}`} />)}
    </div></>}

    {!!s?.auctions.length && <><ShelfHead title={"🔨 " + t("home.auctions")} href="/explorar?finalidade=auction" /><div className="shelf">{s.auctions.map(listingCard)}</div></>}

    {!!s?.markets.length && <><ShelfHead title={"🧺 " + t("home.markets")} href="/pracas" /><div className="shelf">
      {s.markets.map(m => <a key={m.id} href={"/pracas/" + m.id} className="item">
        <div className="item-img">{m.photo_url ? <LiteImg src={m.photo_url} alt="" loading="lazy" placeholder="🧺" /> : <span aria-hidden>🧺</span>}</div>
        <span className="item-title"><strong>{m.name}</strong></span>
        <span className="item-meta">{marketSummaryIn(m, t)}</span>
      </a>)}
    </div></>}

    {!!s?.listings.length && <><ShelfHead title={t("home.new_listings")} href="/explorar" /><div className="shelf">{s.listings.map(listingCard)}</div></>}

    {!!s?.wanted.length && <><ShelfHead title={"🔎 " + t("home.wanted_title")} href="/procura-se" /><div className="shelf">
      {s.wanted.map(x => <a key={x.id} href={"/classificados/" + x.id} className="card wanted-card">
        <span className="item-meta">🔎 {t("home.wanted_badge")}</span>
        <strong className="item-title" style={{ fontSize: 17 }}>{x.title}</strong>
        <span className="muted">{t("home.budget")}</span><strong>{listingPriceLabel(x)}</strong>
      </a>)}
    </div></>}

    <section className="banner yellow" style={{ marginTop: 32 }}>
      <div><h2>{t("home.sell_title")}</h2><p>{t("home.sell_text")}</p></div>
      <div className="row"><a className="btn" href="/classificados/publicar">+ {t("ft.post_ad")}</a><a className="btn secondary" href="/classificados/publicar?finalidade=wanted">🔎 {t("ft.post_wanted")}</a></div>
    </section>

    {!!s?.products.length && <><ShelfHead title={"🛍️ " + t("home.in_shop")} href="/loja" /><div className="shelf">
      {s.products.map(p => <ItemCard save={{ kind: "product", id: p.id }} key={p.id} href={"/loja/" + p.id} media={p.media} title={p.name} price={formatPrice(p.price, p.currency)}
        meta={p.stock > 0 ? [p.seller_name, p.municipality_name].filter(Boolean).join(" · ") : t("home.sold_out")} tag={p.stock > 0 ? undefined : t("home.sold_out")} />)}
    </div></>}

    {!!s?.rentals.length && <><ShelfHead title={"🔑 " + t("home.for_rent")} href="/explorar?finalidade=rent" /><div className="shelf">{s.rentals.map(listingCard)}</div></>}
    {!!s?.trades?.length && <><ShelfHead title={"🔁 " + t("home.trades")} href="/trocas" /><div className="shelf">{s.trades.map(listingCard)}</div></>}

    {!!s?.providers.length && <><ShelfHead title={"👷 " + t("home.trusted_pros")} href="/profissionais" /><div className="shelf">
      {s.providers.map(p => <a key={p.user_id} href={"/profissionais/" + p.user_id} className="card" style={{ color: "inherit", textDecoration: "none", fontWeight: 400 }}>
        {p.avatar_url ? <LiteImg placeholder="👤" src={p.avatar_url} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }} /> : <span style={{ fontSize: 40 }} aria-hidden>👷</span>}
        <strong>{p.display_name}{p.verified ? " ✔️" : ""}</strong>
        <span className="item-meta">{[p.category_name, p.municipality_name].filter(Boolean).join(" · ")}</span>
        <span className="item-meta">{rating(p.rating, p.review_count)}</span>
      </a>)}
    </div></>}

    {s && !s.listings.length && !s.products.length && <section className="card" style={{ marginTop: 28 }}>
      <h2 style={{ margin: 0 }}>{t("home.first_title")}</h2>
      <p style={{ margin: 0 }}>{t("home.first_text")}</p>
      <a className="btn" href="/classificados/publicar" style={{ justifySelf: "start" }}>{t("ft.post_ad")}</a>
    </section>}

    <section className="stack" style={{ marginTop: 32, gap: 8 }} aria-label={t("home.by_municipality")}>
      <div className="shelf-head"><h2>{t("home.by_municipality")}</h2><a href="/huambo">{t("common.see_all")} →</a></div>
      <p style={{ margin: 0 }}>{t("home.by_municipality_text")} <a href="/sobre">{t("ft.about")}</a></p>
      <div className="row">{HUAMBO_MUNICIPALITIES.map(m => <a key={m.slug} className="chip" href={"/huambo/" + m.slug}>{m.name}</a>)}</div>
    </section>

    <section className="banner green" style={{ marginTop: 32 }}>
      <div><h2>{t("home.pro_title")}</h2><p>{t("home.pro_text")}</p></div>
      <div className="row"><a className="btn secondary" href="/conta/profissional">{t("home.i_am_pro")}</a><a className="btn secondary" href="/conta/empresas">{t("home.have_business")}</a><a className="btn secondary" href="/entregas">{t("home.want_courier")}</a><a className="btn secondary" href="/agente">{t("home.want_agent")}</a></div>
    </section>
  </main>;
}
