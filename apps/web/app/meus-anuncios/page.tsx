"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { listMyClassifiedListings, deleteClassifiedListing, updateClassifiedStatus, publishClassifiedListing, removeClassifiedMedia,
  formatPrice, friendlyError, STATUS_LABELS, myOfferCounts, saleModeBadges, listingPriceLabel, formatRef } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { DealCloser } from "../../components/Reputation";
import { LiteImg } from "../../components/LiteImg";

function MeusAnuncios() {
  const params = useSearchParams();
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState(params.get("erro") ? "O anúncio foi guardado como rascunho mas não foi publicado: " + params.get("erro") : "");
  const [busy, setBusy] = useState(""); const [notice, setNotice] = useState(""); const [offers, setOffers] = useState<Record<string, number>>({});

  async function load() {
    const uid = await currentUserId();
    if (!uid) { setError("Inicie sessão para ver os seus anúncios."); setItems([]); return; }
    const r = await listMyClassifiedListings(supabase(), uid);
    if (r.error) setError(friendlyError(r.error)); setItems(r.data ?? []);
    setOffers((await myOfferCounts(supabase())).data);
  }
  useEffect(() => { void load(); }, []);

  async function act(id: string, fn: () => Promise<{ error: any }>) {
    setBusy(id); setError("");
    const r = await fn();
    setBusy("");
    if (r.error) setError(friendlyError(r.error)); else await load();
  }

  return <main className="stack">
    <a href="/">← Huambo Online</a>
    <h1>Os meus anúncios</h1>
    <a className="btn" href="/classificados/publicar">+ Publicar anúncio</a>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items === null && <p>A carregar…</p>}
    {items?.length === 0 && !error && <p>Ainda não publicou anúncios.</p>}
    {items?.map(x => <article key={x.id} className="card">
      {Array.isArray(x.media) && x.media[0] && <LiteImg className="thumb" src={x.media[0]} alt="" style={{ maxWidth: 240 }} />}
      <strong style={{ fontSize: 20 }}>{x.title}</strong>{x.ref_no && <small className="muted">N.º {formatRef("listing", x.ref_no)}</small>}
      <span><span className="badge">{STATUS_LABELS[x.status as keyof typeof STATUS_LABELS] ?? x.status}</span> · {listingPriceLabel(x)}{saleModeBadges(x).map(b => <span key={b}> · <span className="mode-badge">{b}</span></span>)}</span>
      {offers[x.id] > 0 && <a href={"/classificados/" + x.id + "#propostas"} className="ok">💬 {offers[x.id]} proposta(s) à espera de resposta →</a>}
      {x.deal_with && <span>🤝 Negócio registado — <a href="/avaliacoes">avaliar</a></span>}
      <div className="row">
        <a className="btn secondary" href={"/classificados/" + x.id}>Ver</a>
        <a className="btn secondary" href={`/classificados/${x.id}/editar`}>Editar</a>
        {x.status === "published"
          ? <button className="secondary" disabled={busy === x.id} onClick={() => act(x.id, () => updateClassifiedStatus(supabase(), x.id, "paused"))}>Pausar</button>
          : <button disabled={busy === x.id} onClick={() => act(x.id, () => publishClassifiedListing(supabase(), x.id))}>Publicar</button>}
        {["published", "sold", "rented", "closed"].includes(x.status) && <DealCloser listing={x} onDone={msg => { setNotice(msg); void load(); }} />}
        <button className="danger" disabled={busy === x.id} onClick={() => { if (confirm("Apagar este anúncio? Não pode ser desfeito.")) void act(x.id, async () => { const r = await deleteClassifiedListing(supabase(), x.id); if (!r.error) await removeClassifiedMedia(supabase(), x.media ?? []); return r; }); }}>Apagar</button>
      </div>
    </article>)}
  </main>;
}
export default function Page() { return <Suspense fallback={<main><p>A carregar…</p></main>}><MeusAnuncios /></Suspense>; }
