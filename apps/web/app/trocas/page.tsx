"use client";
import { useEffect, useState } from "react";
import { listTrades, listingPriceLabel, friendlyError, timeAgo, PUBLISH_TRADE_HREF } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";
import { ItemCard, LISTING_ICON } from "../../components/ItemCard";

/** Trocas: anúncios «Só troca» e anúncios que também aceitam troca. */
export default function Trocas() {
  const [q, setQ] = useState(""); const [onlyTrade, setOnlyTrade] = useState(false);
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");
  useEffect(() => { const start = new URLSearchParams(window.location.search).get("q") ?? ""; setQ(start); void search(undefined, start); }, []);
  async function search(e?: React.FormEvent, query = q, only = onlyTrade) {
    e?.preventDefault(); setError("");
    const r = await listTrades(supabase(), query, only);
    if (r.error) setError(friendlyError(r.error)); else setItems((r.data as any[]) ?? []);
  }
  return <main className="stack">
    <a href="/">← Início</a>
    <section className="banner blue">
      <div><h1 style={{ margin: 0 }}>🔁 Trocas</h1><p>Troque o que já não usa por algo de que precisa: telemóveis, roupa, móveis, motorizadas… Também aparecem anúncios à venda que aceitam troca.</p></div>
      <a className="btn" href={PUBLISH_TRADE_HREF}>+ Publicar uma troca</a>
    </section>
    <form onSubmit={search} className="row">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Ex.: telemóvel, geleira, motorizada…" style={{ maxWidth: 420 }} aria-label="Procurar trocas" />
      <button type="submit">Procurar</button>
    </form>
    <div className="row" role="tablist">
      <button type="button" role="tab" aria-selected={!onlyTrade} className={!onlyTrade ? "" : "secondary"} onClick={() => { setOnlyTrade(false); void search(undefined, q, false); }}>Todas</button>
      <button type="button" role="tab" aria-selected={onlyTrade} className={onlyTrade ? "" : "secondary"} onClick={() => { setOnlyTrade(true); void search(undefined, q, true); }}>Só troca</button>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {items === null && !error && <p>A carregar…</p>}
    {items?.length === 0 && <div className="card"><strong>Ainda não há trocas{q ? ` com «${q}»` : ""}.</strong><a href={PUBLISH_TRADE_HREF}>Seja o primeiro a publicar uma troca →</a></div>}
    <div className="results-grid">{items?.map(x => <ItemCard key={x.id} video={!!x.video_url} href={"/classificados/" + x.id} media={x.media} title={x.title}
      price={listingPriceLabel(x)} icon={LISTING_ICON[x.listing_type] ?? "🏷️"} tag={x.sale_mode === "trade" ? "Troca" : "Aceita troca"}
      meta={[x.trade_wants ? "Quer: " + x.trade_wants : "", timeAgo(x.published_at ?? x.created_at)].filter(Boolean).join(" · ")} />)}</div>
  </main>;
}
