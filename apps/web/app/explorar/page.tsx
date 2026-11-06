"use client";
import { useEffect, useMemo, useState } from "react";
import { filterFieldsFor, attributeFilters, trackSearch } from "@huambo-online/core";
import { loadWithCache, isOfflineError, searchClassifiedListings, saveClassifiedSearch, listProvinces, listMunicipalities, formatPrice, friendlyErrorIn, parsePrice, readExploreParams, categoryLabelIn,
  LISTING_TYPE_LABELS, PURPOSE_LABELS, type ClassifiedSearchFilters, listingPriceLabel, SALE_MODE_FILTERS, cardSaleTag, isFeatured } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";
import { useT, timeAgoIn } from "../../lib/i18n";
import { ItemCard, LISTING_ICON } from "../../components/ItemCard";
import { OfflineBanner } from "../../components/Offline";
import { browserStore } from "../../components/Engage";
import { getPublic } from "../../lib/public-api";
import { classifiedsCached } from "@huambo-online/core";
import { SmartSearchButton } from "../../components/AiTools";

type Option = { id: string; name: string };
type F = { q: string; purpose: string; type: string; categoryId: string; provinceId: string; municipalityId: string; min: string; max: string; mode: string; attrs: Record<string, string> };
const EMPTY: F = { q: "", purpose: "", type: "", categoryId: "", provinceId: "", municipalityId: "", min: "", max: "", mode: "", attrs: {} };

export default function ExplorarPage() {
  const { lang, t, tc } = useT();
  const [f, setF] = useState<F>(EMPTY);
  const [name, setName] = useState(""); const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<(Option & { slug?: string })[]>([]); const [provinces, setProvinces] = useState<Option[]>([]); const [municipalities, setMunicipalities] = useState<Option[]>([]);
  const [offline, setOffline] = useState<{ on: boolean; at: number | null }>({ on: false, at: null });
  const [sort, setSort] = useState<"recent" | "price_asc" | "price_desc">("recent");
  const [view, setView] = useState<"grid" | "list">("grid"); const [filtersOpen, setFiltersOpen] = useState(false);
  const [places, setPlaces] = useState<Record<string, string>>({});
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);

  // Vista escolhida (grelha ou lista) fica guardada neste navegador.
  useEffect(() => { try { const v = localStorage.getItem("huambo:vista"); if (v === "list" || v === "grid") setView(v); } catch { /* sem armazenamento */ } }, []);
  function chooseView(v: "grid" | "list") { setView(v); try { localStorage.setItem("huambo:vista", v); } catch { /* sem armazenamento */ } }
  // Nomes dos municípios para mostrar o local em cada cartão.
  useEffect(() => { void supabase().from("municipalities").select("id,name").then(({ data }) => setPlaces(Object.fromEntries(((data ?? []) as Option[]).map(m => [m.id, m.name])))); }, []);
  useEffect(() => {
    const c = supabase();
    void listProvinces(c).then(({ data }) => setProvinces((data ?? []) as Option[]));
    const p = new URLSearchParams(window.location.search);
    const fromUrl = readExploreParams(k => p.get(k));
    // «?categoria=emprego» escolhe logo essa categoria (as categorias carregam primeiro).
    void c.from("categories").select("id,name,slug").eq("type", "classified").eq("active", true).order("name").then(({ data }) => {
      const list = (data ?? []) as (Option & { slug?: string })[]; setCategories(list);
      const categoryId = fromUrl.categorySlug ? list.find(x => x.slug === fromUrl.categorySlug)?.id ?? "" : "";
      const start = { ...EMPTY, q: fromUrl.query, type: fromUrl.listingType, purpose: fromUrl.purpose, mode: fromUrl.saleMode, categoryId };
      setF(start); void search(start);
    });
  }, []);
  useEffect(() => {
    if (!f.provinceId) { setMunicipalities([]); return; }
    void listMunicipalities(supabase(), f.provinceId).then(({ data }) => setMunicipalities((data ?? []) as Option[]));
  }, [f.provinceId]);

  function toFilters(v: F): ClassifiedSearchFilters {
    const attributes = attributeFilters(v.type, categories.find(c => c.id === v.categoryId)?.slug, v.attrs);
    return { query: v.q, purpose: (v.purpose || undefined) as any, listingType: (v.type || undefined) as any, categoryId: v.categoryId || undefined, ...(Object.keys(attributes).length ? { attributes } : {}),
      provinceId: v.provinceId || undefined, municipalityId: v.municipalityId || undefined, minPrice: parsePrice(v.min), maxPrice: parsePrice(v.max), saleMode: (v.mode || undefined) as ClassifiedSearchFilters["saleMode"] };
  }
  async function search(v = f) {
    setError(""); setNotice(""); setBusy(true);
    const fl = toFilters(v); const key = JSON.stringify(fl);
    void trackSearch(supabase(), { query: fl.query, categoryId: fl.categoryId, listingType: fl.listingType });
    // Guarda a última pesquisa para a mostrar quando a rede falhar.
    const r = await loadWithCache<{ key: string; items: any[] }>(browserStore, "explorar", async () => { const x = await classifiedsCached(getPublic, () => searchClassifiedListings(supabase(), fl), fl as Record<string, unknown>); return { data: x.data ? { key, items: x.data as any[] } : null, error: x.error }; });
    const usable = r.data && r.data.key === key ? r.data.items : null;
    setOffline({ on: r.fromCache || isOfflineError(r.error), at: usable ? r.savedAt : null });
    setBusy(false);
    if (r.error && !isOfflineError(r.error)) setError(friendlyErrorIn(r.error, lang)); else setItems(usable ?? []);
  }
  function quick(patch: Partial<F>) { const v = { ...f, ...patch }; setF(v); void search(v); }
  async function save() {
    setError(""); setNotice("");
    const c = supabase(); const u = await c.auth.getUser();
    if (!u.data.user) { setError(t("ls.login_to_save_search")); return; }
    if (!name.trim()) { setError(t("ls.search_need_name")); return; }
    const r = await saveClassifiedSearch(c, name, toFilters(f));
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setName(""); setNotice(t("ls.search_saved")); }
  }
  const sorted = useMemo(() => {
    if (!items || sort === "recent") return items;
    const price = (x: any) => (typeof x.price === "number" && x.price > 0 ? x.price : null);
    return [...items].sort((a, b) => { const pa = price(a), pb = price(b); if (pa === null) return 1; if (pb === null) return -1; return sort === "price_asc" ? pa - pb : pb - pa; });
  }, [items, sort]);
  const activeFilters = [f.q, f.type, f.categoryId, f.provinceId, f.municipalityId, f.min, f.max, ...Object.values(f.attrs)].filter(Boolean).length;
  const set = (k: keyof F) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return <main className="stack">
    <a href="/">← {t("nav.home")}</a>
    <h1>{f.q ? <>{t("ls.results_for", { q: f.q })}</> : f.type ? tc(LISTING_TYPE_LABELS[f.type as keyof typeof LISTING_TYPE_LABELS]) : f.purpose ? tc(PURPOSE_LABELS[f.purpose as keyof typeof PURPOSE_LABELS]) : t("scope.classificados")}</h1>
    <nav className="chips" aria-label={t("ls.purpose")}>
      {([["", t("ls.everything")], ...Object.entries(PURPOSE_LABELS).map(([v, l]) => [v, tc(l)])] as [string, string][]).map(([v, l]) => <button key={v} type="button" className={"chip" + (f.purpose === v ? " on" : "")} aria-pressed={f.purpose === v} onClick={() => quick({ purpose: v })}>{l}</button>)}
    </nav>
    <nav className="chips" aria-label={t("ls.how_sells")}>
      <span className="muted" style={{ alignSelf: "center", fontWeight: 700 }}>{t("ls.how_sells")}:</span>
      {([{ value: "", label: t("ls.all") }, ...SALE_MODE_FILTERS.map(m => ({ ...m, label: tc(m.label) }))] as { value: string; label: string }[]).map(m => <button key={m.value} type="button" className={"chip" + (f.mode === m.value ? " on" : "")} aria-pressed={f.mode === m.value} onClick={() => quick({ mode: m.value })}>{m.label}</button>)}
    </nav>
    <div className="results">
      <button type="button" className="secondary filters-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>⚙️ {t("ls.filters")}{activeFilters ? ` (${activeFilters})` : ""}</button>
      <form className={"filters card" + (filtersOpen ? " open" : "")} onSubmit={e => { e.preventDefault(); setFiltersOpen(false); void search(); }}>
        <div className="row" style={{ justifyContent: "space-between" }}><h2>{t("ls.filters")}</h2><button type="button" className="secondary" onClick={() => setShowFilters(!showFilters)} style={{ minHeight: 40, padding: "4px 14px" }} aria-expanded={showFilters}>{showFilters ? t("ls.less") : t("ls.more")}</button></div>
        <label>{t("nav.search")}<input value={f.q} onChange={set("q")} placeholder={t("ls.ph_search")} /></label>
        <SmartSearchButton text={f.q} categories={categories.map(c => ({ slug: c.slug, name: c.name }))} onApply={x => {
          const v: F = { ...f, q: x.query, type: x.listingType, purpose: x.purpose, mode: "", min: x.minPrice, max: x.maxPrice, attrs: x.attributes,
            categoryId: x.categorySlug ? categories.find(c => c.slug === x.categorySlug)?.id ?? "" : "" };
          setF(v); void search(v);
        }} />
        <label>{t("ls.type")}<select value={f.type} onChange={e => setF({ ...f, type: e.target.value, attrs: {} })}><option value="">{t("ls.all")}</option>{Object.entries(LISTING_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{tc(l)}</option>)}</select></label>
        <label>{t("ls.category")}<select value={f.categoryId} onChange={e => setF({ ...f, categoryId: e.target.value, attrs: {} })}><option value="">{t("ls.all_f")}</option>{categories.map(c => <option key={c.id} value={c.id}>{categoryLabelIn(c.name, lang)}</option>)}</select></label>
        {/* Filtros da categoria ou do tipo: subcategoria, estado, combustível, tipo de imóvel… */}
        {filterFieldsFor(f.type, categories.find(c => c.id === f.categoryId)?.slug).map(fd => <label key={fd.key}>{t("attr." + fd.key)}
          <select value={f.attrs[fd.key] ?? ""} onChange={e => setF({ ...f, attrs: { ...f.attrs, [fd.key]: e.target.value } })}>
            <option value="">{t("ls.all")}</option>{fd.options!.map(o => <option key={o} value={o}>{t(`attr.${fd.key}.${o}`)}</option>)}
          </select></label>)}
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <label style={{ flex: 1 }}>{t("ls.price_min")}<input value={f.min} onChange={set("min")} inputMode="numeric" placeholder="Kz" /></label>
          <label style={{ flex: 1 }}>{t("ls.price_max")}<input value={f.max} onChange={set("max")} inputMode="numeric" placeholder="Kz" /></label>
        </div>
        {showFilters && <>
          <label>{t("ls.province")}<select value={f.provinceId} onChange={e => setF({ ...f, provinceId: e.target.value, municipalityId: "" })}><option value="">{t("ls.all_f")}</option>{provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>{t("auth.municipality")}<select value={f.municipalityId} disabled={!f.provinceId} onChange={set("municipalityId")}><option value="">{t("ls.all")}</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        </>}
        <button type="submit" disabled={busy}>{busy ? t("ls.searching") : t("ls.apply_filters")}</button>
        <hr style={{ border: 0, borderTop: "1px solid var(--line)", width: "100%" }} />
        <label>{t("ls.save_this_search")}<input value={name} onChange={e => setName(e.target.value)} placeholder={t("ls.ph_search_name")} /></label>
        <button type="button" className="secondary" onClick={save}>⭐ {t("ls.save_and_alert")}</button>
      </form>
      <section className="stack" aria-label={t("ls.results")}>
        <div className="results-bar">
          <strong>{items === null ? t("common.loading") : t("ls.n_results", { n: items.length })}</strong>
          <div className="row" style={{ gap: 8 }}>
            <label className="sort-select"><span className="muted">{t("ls.sort")}</span>
              <select value={sort} onChange={e => setSort(e.target.value as typeof sort)}>
                <option value="recent">{t("ls.sort_recent")}</option><option value="price_asc">{t("ls.sort_price_asc")}</option><option value="price_desc">{t("ls.sort_price_desc")}</option>
              </select></label>
            <div className="view-toggle" role="group" aria-label={t("ls.view_mode")}>
              <button type="button" aria-pressed={view === "grid"} title={t("ls.view_grid")} aria-label={t("ls.view_grid")} onClick={() => chooseView("grid")}>▦</button>
              <button type="button" aria-pressed={view === "list"} title={t("ls.view_list")} aria-label={t("ls.view_list")} onClick={() => chooseView("list")}>☰</button>
            </div>
            <a className="btn" href="/classificados/publicar" style={{ minHeight: 40, padding: "6px 16px", fontSize: 15 }}>+ {t("ls.publish_listing")}</a>
          </div>
        </div>
        <OfflineBanner show={offline.on} savedAt={offline.at} />
        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="ok" role="status">{notice}</p>}
        {items?.length === 0 && <div className="card"><strong>{t("ls.no_listings_found")}</strong><span>{t("ls.try_other_words")} <a href="/classificados/publicar">{t("ls.publish_first")}</a></span></div>}
        <div className={"results-grid" + (view === "list" ? " list" : "")}>
          {sorted?.map(x => <ItemCard key={x.id} featured={isFeatured(x)} video={!!x.video_url} href={`/classificados/${x.id}`} media={x.media} title={x.title} price={listingPriceLabel(x)}
            icon={LISTING_ICON[x.listing_type] ?? "🏷️"} tag={x.purpose === "auction" ? t("purpose.auction") : x.purpose !== "sale" ? t("purpose." + x.purpose) : cardSaleTag(x)} tagRed={x.purpose === "auction"}
            meta={[places[x.attributes?.municipalityId] ? "📍 " + places[x.attributes.municipalityId] : "", tc(LISTING_TYPE_LABELS[x.listing_type as keyof typeof LISTING_TYPE_LABELS]), timeAgoIn(x.published_at ?? x.created_at, lang)].filter(Boolean).join(" · ")} />)}
        </div>
      </section>
    </div>
  </main>;
}
