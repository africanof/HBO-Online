"use client";
import { useEffect, useState } from "react";
import { listTrades, listingPriceLabel, friendlyErrorIn, PUBLISH_TRADE_HREF, isFeatured } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";
import { ItemCard, LISTING_ICON } from "../../components/ItemCard";
import { useT, timeAgoIn } from "../../lib/i18n";

/** Trocas: anúncios «Só troca» e anúncios que também aceitam troca. */
export default function Trocas() {
  const { lang, t } = useT();
  const [q, setQ] = useState(""); const [onlyTrade, setOnlyTrade] = useState(false);
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");
  useEffect(() => { const start = new URLSearchParams(window.location.search).get("q") ?? ""; setQ(start); void search(undefined, start); }, []);
  async function search(e?: React.FormEvent, query = q, only = onlyTrade) {
    e?.preventDefault(); setError("");
    const r = await listTrades(supabase(), query, only);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems((r.data as any[]) ?? []);
  }
  return <main className="stack">
    <a href="/">← {t("nav.home")}</a>
    <section className="banner blue">
      <div><h1 style={{ margin: 0 }}>🔁 {t("home.trades")}</h1><p>{t("ls.trades_intro")}</p></div>
      <a className="btn" href={PUBLISH_TRADE_HREF}>+ {t("ls.post_trade")}</a>
    </section>
    <form onSubmit={search} className="row">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("ls.ph_trade_search")} style={{ maxWidth: 420 }} aria-label={t("ls.search_trades")} />
      <button type="submit">{t("ls.search_btn")}</button>
    </form>
    <div className="row" role="tablist">
      <button type="button" role="tab" aria-selected={!onlyTrade} className={!onlyTrade ? "" : "secondary"} onClick={() => { setOnlyTrade(false); void search(undefined, q, false); }}>{t("ls.all_f")}</button>
      <button type="button" role="tab" aria-selected={onlyTrade} className={onlyTrade ? "" : "secondary"} onClick={() => { setOnlyTrade(true); void search(undefined, q, true); }}>{t("ls.trade_only")}</button>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {items === null && !error && <p>{t("common.loading")}</p>}
    {items?.length === 0 && <div className="card"><strong>{q ? t("ls.no_trades_q", { q }) : t("ls.no_trades")}</strong><a href={PUBLISH_TRADE_HREF}>{t("ls.be_first_trade")} →</a></div>}
    <div className="results-grid">{items?.map(x => <ItemCard key={x.id} featured={isFeatured(x)} video={!!x.video_url} href={"/classificados/" + x.id} media={x.media} title={x.title}
      price={listingPriceLabel(x)} icon={LISTING_ICON[x.listing_type] ?? "🏷️"} tag={x.sale_mode === "trade" ? t("ls.trade") : t("ls.accepts_trade_tag")}
      meta={[x.trade_wants ? t("ls.wants") + " " + x.trade_wants : "", timeAgoIn(x.published_at ?? x.created_at, lang)].filter(Boolean).join(" · ")} />)}</div>
  </main>;
}
