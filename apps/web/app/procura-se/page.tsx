"use client";
import { useEffect, useState } from "react";
import { listWanted, listingPriceLabel, friendlyErrorIn, LISTING_TYPE_LABELS } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";
import { useT, timeAgoIn } from "../../lib/i18n";

/** Pedidos de compradores: "Preciso de…", "Pago…", "Procuro…". */
export default function ProcuraSe() {
  const { lang, t, tc } = useT();
  const [q, setQ] = useState(""); const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");
  useEffect(() => { const start = new URLSearchParams(window.location.search).get("q") ?? ""; setQ(start); void search(undefined, start); }, []);
  async function search(e?: React.FormEvent, query = q) {
    e?.preventDefault(); setError("");
    const r = await listWanted(supabase(), query);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems((r.data as any[]) ?? []);
  }
  return <main className="stack">
    <a href="/">← {t("nav.home")}</a>
    <section className="banner yellow">
      <div><h1 style={{ margin: 0 }}>🔎 {t("home.wanted")}</h1><p>{t("ls.wanted_page_intro")}</p></div>
      <a className="btn" href="/classificados/publicar?finalidade=wanted">+ {t("ft.post_wanted")}</a>
    </section>
    <form onSubmit={search} className="row">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("ls.ph_wanted_search")} style={{ maxWidth: 420 }} aria-label={t("ls.search_requests")} />
      <button type="submit">{t("ls.search_btn")}</button>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
    {items?.length === 0 && <div className="card"><strong>{q ? t("ls.no_requests_q", { q }) : t("ls.no_requests")}</strong><a href="/classificados/publicar?finalidade=wanted">{t("ls.be_first_wanted")} →</a></div>}
    <section className="stack">
      {items?.map(x => <a key={x.id} href={"/classificados/" + x.id} className="card wanted-card">
        <span className="badge" style={{ justifySelf: "start", background: "var(--yellow-soft)", borderColor: "var(--yellow-line)", color: "var(--yellow-text)" }}>🔎 {t("home.wanted_badge")} · {tc(LISTING_TYPE_LABELS[x.listing_type as keyof typeof LISTING_TYPE_LABELS] ?? x.listing_type)}</span>
        <strong style={{ fontSize: 20 }}>{x.title}</strong>
        <span><span className="muted">{t("home.budget")}</span> <strong style={{ fontSize: 19 }}>{tc(listingPriceLabel(x))}</strong></span>
        {x.description && <span className="muted">{String(x.description).slice(0, 140)}</span>}
        <span className="item-meta">{timeAgoIn(x.published_at ?? x.created_at, lang)} · {t("ls.have_it_tap")}</span>
      </a>)}
    </section>
  </main>;
}
