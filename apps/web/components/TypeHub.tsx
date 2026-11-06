"use client";
import { useEffect, useState } from "react";
import { searchClassifiedListings, trackSearch, filterFieldsFor, attributeFilters, detailFacts, listingPriceLabel, isFeatured, friendlyErrorIn, PURPOSE_LABELS } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ItemCard } from "./ItemCard";
import { useT, timeAgoIn } from "../lib/i18n";

type Kind = "vehicle" | "real_estate";
const CONF: Record<Kind, { icon: string; purposes: string[] }> = {
  vehicle: { icon: "🚗", purposes: ["sale", "lease"] },
  real_estate: { icon: "🏠", purposes: ["sale", "rent"] }
};

/** Página própria de Viaturas ou Imóveis: separadores (venda/aluguer), filtros do tipo e «Publicar» com o tipo escolhido. */
export function TypeHub({ kind }: { kind: Kind }) {
  const { lang, t, tc } = useT();
  const c = CONF[kind];
  const [purpose, setPurpose] = useState(""); const [q, setQ] = useState(""); const [attrs, setAttrs] = useState<Record<string, string>>({});
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");
  async function load(p = purpose, a = attrs, query = q) {
    setError(""); setItems(null);
    const attributes = attributeFilters(kind, null, a);
    void trackSearch(supabase(), { query, listingType: kind });
    const r = await searchClassifiedListings(supabase(), { listingType: kind, purpose: (p || undefined) as any, query, ...(Object.keys(attributes).length ? { attributes } : {}), limit: 60 });
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems((r.data ?? []) as any[]);
  }
  useEffect(() => { const p = new URLSearchParams(window.location.search).get("finalidade") ?? ""; const v = c.purposes.includes(p) ? p : ""; setPurpose(v); void load(v); }, []);
  const facts = (x: any) => detailFacts(kind, x.attributes).filter(f => f.key !== "brand" && f.key !== "model").slice(0, 3)
    .map(f => f.option ? t(`attr.${f.key}.${f.value}`) : f.unit ? `${Number(f.value).toLocaleString("pt-PT")} ${t("attr.unit." + f.unit)}` : f.key === "bedrooms" ? `${f.value} ${t("attr.bedrooms").toLowerCase()}` : f.value);

  return <main className="stack">
    <a href="/">← {t("nav.home")}</a>
    <section className="banner blue">
      <div><h1 style={{ margin: 0 }}>{c.icon} {t(`hub.${kind}.title`)}</h1><p>{t(`hub.${kind}.intro`)}</p>{kind === "real_estate" && <p style={{ fontWeight: 800 }}>{t("ls.rent_free_badge")}</p>}</div>
      <a className="btn" href={`/classificados/publicar?tipo=${kind}`}>+ {t(`hub.${kind}.publish`)}</a>
    </section>
    <form onSubmit={e => { e.preventDefault(); void load(); }} className="row">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={t(`hub.${kind}.search_ph`)} style={{ maxWidth: 420 }} aria-label={t("nav.search")} />
      <button type="submit">{t("ls.search_btn")}</button>
    </form>
    <div className="row" role="radiogroup" aria-label={t("ls.purpose")}>
      {["", ...c.purposes].map(p => <button key={p || "all"} type="button" role="radio" aria-checked={purpose === p} className={"chip" + (purpose === p ? " on" : "")}
        onClick={() => { setPurpose(p); void load(p); }}>{p ? tc(PURPOSE_LABELS[p as keyof typeof PURPOSE_LABELS]) : t("job.all")}</button>)}
    </div>
    <div className="row">{filterFieldsFor(kind).map(fd => <label key={fd.key} style={{ flex: "1 1 180px" }}>{t("attr." + fd.key)}
      <select value={attrs[fd.key] ?? ""} onChange={e => { const a = { ...attrs, [fd.key]: e.target.value }; setAttrs(a); void load(purpose, a); }}>
        <option value="">{t("ls.all")}</option>{fd.options!.map(o => <option key={o} value={o}>{t(`attr.${fd.key}.${o}`)}</option>)}
      </select></label>)}</div>
    {error && <p className="error" role="alert">{error}</p>}
    {items === null && !error && <p>{t("common.loading")}</p>}
    {items?.length === 0 && <div className="card"><strong>{t(`hub.${kind}.none`)}</strong><a href={`/classificados/publicar?tipo=${kind}`}>{t(`hub.${kind}.be_first`)} →</a></div>}
    <div className="results-grid">{items?.map(x => <ItemCard save={{ kind: "listing", id: x.id }} key={x.id} featured={isFeatured(x)} video={!!x.video_url} href={"/classificados/" + x.id} media={x.media}
      title={x.title} price={tc(listingPriceLabel(x))} icon={c.icon} tag={x.purpose !== "sale" ? tc(PURPOSE_LABELS[x.purpose as keyof typeof PURPOSE_LABELS] ?? x.purpose) : undefined}
      meta={[...facts(x), timeAgoIn(x.published_at ?? x.created_at, lang)].filter(Boolean).join(" · ")} />)}</div>
  </main>;
}
