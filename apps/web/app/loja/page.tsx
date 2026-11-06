"use client";
import { useEffect, useMemo, useState } from "react";
import { listProducts, listProductCategories, formatPrice, friendlyErrorIn } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";
import { useTerritory } from "../../components/Directory";
import { ItemCard } from "../../components/ItemCard";
import { useT } from "../../lib/i18n";
import { ResultsToolbar, FiltersToggle, useViewMode, byPrice } from "../../components/ResultsTools";

type Option = { id: string; name: string };

export default function Loja() {
  const { lang, t } = useT();
  const [q, setQ] = useState(""); const [categoryId, setCategoryId] = useState(""); const [municipalityId, setMunicipalityId] = useState("");
  const [categories, setCategories] = useState<Option[]>([]); const { municipalities } = useTerritory();
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");
  const [sort, setSort] = useState<"recent" | "price_asc" | "price_desc" | "name">("recent"); const [view, setView] = useViewMode(); const [filtersOpen, setFiltersOpen] = useState(false);
  const sorted = useMemo(() => !items ? items : sort === "price_asc" ? byPrice(items, "asc") : sort === "price_desc" ? byPrice(items, "desc")
    : sort === "name" ? [...items].sort((a, b) => String(a.name).localeCompare(String(b.name), lang)) : items, [items, sort, lang]);
  useEffect(() => {
    void listProductCategories(supabase()).then(({ data }) => setCategories(data ?? []));
    const start = new URLSearchParams(window.location.search).get("q") ?? "";
    setQ(start); void search(undefined, { q: start });
  }, []);
  async function search(e?: React.FormEvent, over: { q?: string; categoryId?: string } = {}) {
    e?.preventDefault(); setError("");
    const r = await listProducts(supabase(), { query: over.q ?? q, categoryId: over.categoryId ?? categoryId, municipalityId });
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems((r.data as any[]) ?? []);
  }
  return <main className="stack">
    <a href="/">← {t("nav.home")}</a>
    <div className="results-bar"><h1 style={{ margin: 0 }}>{q ? t("sh.shop.title_q", { q }) : t("nav.shop")}</h1>
      <div className="row"><a className="btn" href="/carrinho">🛒 {t("sh.cart")}</a><a className="btn secondary" href="/encomendas">📦 {t("sh.orders")}</a><a className="btn secondary" href="/conta/produtos">{t("sh.shop.sell_products")}</a></div></div>
    <p style={{ margin: 0 }}>{t("sh.shop.intro")}</p>
    <ul className="trust-strip" aria-label={t("sh.shop.about")}>
      <li>🚚 {t("sh.shop.point_delivery")}</li>
      <li>🛡️ {t("sh.shop.point_protected")}</li>
      <li>🏪 {t("sh.shop.point_sellers")}</li>
    </ul>
    {categories.length > 0 && <nav className="chips" aria-label={t("sh.shop.categories")}>
      {[{ id: "", name: t("sh.shop.all") }, ...categories].map(c => <button key={c.id} type="button" className={"chip" + (categoryId === c.id ? " on" : "")} aria-pressed={categoryId === c.id} onClick={() => { setCategoryId(c.id); void search(undefined, { categoryId: c.id }); }}>{c.name}</button>)}
    </nav>}
    <div className="results">
      <FiltersToggle open={filtersOpen} onToggle={() => setFiltersOpen(!filtersOpen)} active={[q, municipalityId].filter(Boolean).length} />
      <form onSubmit={e => { setFiltersOpen(false); void search(e); }} className={"filters card" + (filtersOpen ? " open" : "")}>
        <h2>{t("sh.shop.filters")}</h2>
        <label>{t("nav.search")}<input value={q} onChange={e => setQ(e.target.value)} placeholder={t("sh.shop.search_ph")} /></label>
        <label>{t("auth.municipality")}<select value={municipalityId} onChange={e => setMunicipalityId(e.target.value)}><option value="">{t("sh.all_m")}</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <button type="submit">{t("sh.shop.apply")}</button>
      </form>
      <section className="stack" aria-label={t("sh.products")}>
        <ResultsToolbar count={items === null ? t("common.loading") : t(items.length === 1 ? "sh.shop.count_one" : "sh.shop.count_many", { n: items.length })}
          sort={sort} onSort={setSort} view={view} onView={setView}
          sorts={[{ value: "recent", label: t("ls.sort_recent") }, { value: "price_asc", label: t("ls.sort_price_asc") }, { value: "price_desc", label: t("ls.sort_price_desc") }, { value: "name", label: t("ls.sort_name") }]} />
        {error && <p className="error" role="alert">{error}</p>}
        {items?.length === 0 && <div className="card"><strong>{t("sh.shop.empty")}</strong><a href="/conta/produtos">{t("sh.shop.sell_here")} →</a></div>}
        <div className={"results-grid" + (view === "list" ? " list" : "")}>{sorted?.map(p => <ItemCard save={{ kind: "product", id: p.id }} key={p.id} href={"/loja/" + p.id} media={p.media} title={p.name} price={formatPrice(p.price, p.currency)}
          tag={p.stock > 0 ? undefined : t("sh.sold_out")} meta={[p.stock > 0 ? t("sh.in_stock", { n: p.stock }) : null, p.seller_name, p.municipality_name].filter(Boolean).join(" · ")} />)}</div>
      </section>
    </div>
  </main>;
}
