"use client";
import { useEffect, useState } from "react";
import { listAgroListings, listingPriceLabel, readAgro, agroSummary, friendlyErrorIn, isFeatured, AGRO_CATEGORIES, type AgroCategory } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";
import { ItemCard } from "../../components/ItemCard";
import { useT, timeAgoIn } from "../../lib/i18n";

/** Agricultura e campo: colheitas, gado, insumos e serviços agrícolas do Huambo. */
export default function Agricultura() {
  const { lang, t, tc } = useT();
  const [cat, setCat] = useState<AgroCategory | "">(""); const [q, setQ] = useState("");
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");
  async function load(c = cat, query = q) {
    setError("");
    const r = await listAgroListings(supabase(), { category: c, query });
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems(r.data);
  }
  useEffect(() => { const tp = new URLSearchParams(window.location.search).get("tipo") as AgroCategory | null; const c = tp && AGRO_CATEGORIES.some(x => x.value === tp) ? tp : ""; setCat(c); void load(c, ""); }, []);
  return <main className="stack">
    <a href="/">← {t("nav.home")}</a>
    <section className="banner blue">
      <div><h1 style={{ margin: 0 }}>🌾 {t("ft.farming")}</h1><p>{t("ls.agro_intro")}</p></div>
      <a className="btn" href="/classificados/publicar?campo=1">+ {t("ls.sell_farm")}</a>
    </section>
    <form onSubmit={e => { e.preventDefault(); void load(); }} className="row">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("ls.ph_agro_search")} style={{ maxWidth: 420 }} aria-label={t("ls.search_farm")} />
      <button type="submit">{t("ls.search_btn")}</button>
    </form>
    <div className="row" role="radiogroup" aria-label={t("ls.farm_type")}>
      <button type="button" role="radio" aria-checked={cat === ""} className={"chip" + (cat === "" ? " on" : "")} onClick={() => { setCat(""); void load("", q); }}>{t("ls.everything")}</button>
      {AGRO_CATEGORIES.map(c => <button key={c.value} type="button" role="radio" aria-checked={cat === c.value} className={"chip" + (cat === c.value ? " on" : "")} onClick={() => { setCat(c.value); void load(c.value, q); }}>{c.icon} {tc(c.label).replace(/ ?[(（].*[)）]$/, "")}</button>)}
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {items === null && !error && <p>{t("common.loading")}</p>}
    {items?.length === 0 && <div className="card"><strong>{q ? t(cat ? "ls.no_listings_type_q" : "ls.no_listings_q", { q }) : t(cat ? "ls.no_listings_type" : "ls.no_listings")}</strong><a href="/classificados/publicar?campo=1">{t("ls.be_first_listing")} →</a></div>}
    <div className="results-grid">{items?.map(x => { const a = readAgro(x.attributes); const c = AGRO_CATEGORIES.find(k => k.value === a?.category);
      return <ItemCard save={{ kind: "listing", id: x.id }} key={x.id} featured={isFeatured(x)} video={!!x.video_url} href={"/classificados/" + x.id} media={x.media} title={x.title}
        price={listingPriceLabel(x)} icon={c?.icon ?? "🌾"} tag={x.purpose === "wanted" ? t("ls.looking_for") : undefined}
        meta={[a ? tc(agroSummary(a)).split(" · ").slice(1).join(" · ") : "", timeAgoIn(x.created_at, lang)].filter(Boolean).join(" · ")} />; })}</div>
  </main>;
}
