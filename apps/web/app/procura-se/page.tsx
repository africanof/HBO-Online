"use client";
import { useEffect, useState } from "react";
import { listWanted, listingPriceLabel, friendlyError, timeAgo, LISTING_TYPE_LABELS } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";

/** Pedidos de compradores: "Preciso de…", "Pago…", "Procuro…". */
export default function ProcuraSe() {
  const [q, setQ] = useState(""); const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");
  useEffect(() => { const start = new URLSearchParams(window.location.search).get("q") ?? ""; setQ(start); void search(undefined, start); }, []);
  async function search(e?: React.FormEvent, query = q) {
    e?.preventDefault(); setError("");
    const r = await listWanted(supabase(), query);
    if (r.error) setError(friendlyError(r.error)); else setItems((r.data as any[]) ?? []);
  }
  return <main className="stack">
    <a href="/">← Início</a>
    <section className="banner yellow">
      <div><h1 style={{ margin: 0 }}>🔎 Procura-se</h1><p>Pedidos de compradores do Huambo. Tem o que procuram? Responda e venda.</p></div>
      <a className="btn" href="/classificados/publicar?finalidade=wanted">+ Publicar o que procuro</a>
    </section>
    <form onSubmit={search} className="row">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Ex.: casa, telefone, router…" style={{ maxWidth: 420 }} aria-label="Procurar pedidos" />
      <button type="submit">Procurar</button>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
    {items?.length === 0 && <div className="card"><strong>Ainda não há pedidos{q ? ` com «${q}»` : ""}.</strong><a href="/classificados/publicar?finalidade=wanted">Seja o primeiro a publicar o que procura →</a></div>}
    <section className="stack">
      {items?.map(x => <a key={x.id} href={"/classificados/" + x.id} className="card wanted-card">
        <span className="badge" style={{ justifySelf: "start", background: "#fff4d6", borderColor: "#f5af02" }}>🔎 PROCURA-SE · {LISTING_TYPE_LABELS[x.listing_type as keyof typeof LISTING_TYPE_LABELS] ?? x.listing_type}</span>
        <strong style={{ fontSize: 20 }}>{x.title}</strong>
        <span><span className="muted">Orçamento:</span> <strong style={{ fontSize: 19 }}>{listingPriceLabel(x)}</strong></span>
        {x.description && <span className="muted">{String(x.description).slice(0, 140)}</span>}
        <span className="item-meta">{timeAgo(x.published_at ?? x.created_at)} · Tem isto? Toque para responder</span>
      </a>)}
    </section>
  </main>;
}
