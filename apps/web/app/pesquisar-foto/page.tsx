"use client";
import { useEffect, useState } from "react";
import { analyzePhoto, photoSearchesLeft, photoSearchMessage, searchByKeywords, fitWithin, formatPrice, timeAgo,
  PHOTO_SEARCH_DAILY_LIMIT, PURPOSE_LABELS, type PhotoSearchResult } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { ItemCard, LISTING_ICON } from "../../components/ItemCard";

/** Reduz a fotografia no navegador (lado maior 1024 px, JPEG) e devolve base64 + pré-visualização. */
async function shrink(file: File): Promise<{ base64: string; preview: string }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  const preview = canvas.toDataURL("image/jpeg", 0.8);
  return { base64: preview.split(",")[1], preview };
}

export default function PesquisarFoto() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [left, setLeft] = useState<number | null>(null);
  const [preview, setPreview] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [result, setResult] = useState<PhotoSearchResult | null>(null);
  const [items, setItems] = useState<{ listings: any[]; products: any[] } | null>(null);

  useEffect(() => { void currentUserId().then(async id => { setUid(id); if (id) setLeft(await photoSearchesLeft(supabase())); }); }, []);

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(""); setResult(null); setItems(null); setBusy(true);
    try {
      const { base64, preview } = await shrink(file);
      setPreview(preview);
      const r = await analyzePhoto(supabase(), base64, "image/jpeg");
      if (r.error || !r.data) { setError(photoSearchMessage(r.error ?? "PHOTO_SEARCH_FAILED")); return; }
      setResult(r.data); setLeft(r.data.remaining);
      if (r.data.found) setItems(await searchByKeywords(supabase(), r.data.keywords));
    } catch { setError(photoSearchMessage("INVALID_IMAGE")); }
    finally { setBusy(false); }
  }

  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main className="stack"><a href="/">← Início</a><h1>📷 Pesquisar por fotografia</h1>
    <p>Tire uma fotografia de um artigo e encontramos anúncios e produtos parecidos no Huambo Online.</p>
    <p><a className="btn" href="/conta/login?voltar=/pesquisar-foto">Entrar para pesquisar</a></p></main>;

  const total = items ? items.listings.length + items.products.length : 0;
  return <main className="stack">
    <a href="/">← Início</a>
    <h1>📷 Pesquisar por fotografia</h1>
    <p>Tire uma fotografia (ou escolha uma da galeria) de um artigo: telemóvel, sapatos, cimento, uma viatura… e mostramos o que há à venda no Huambo Online.</p>
    <div className="card">
      <label className="btn" style={{ justifySelf: "start", cursor: busy ? "wait" : "pointer" }}>
        {busy ? "A analisar a fotografia…" : "📷 Tirar ou escolher fotografia"}
        <input type="file" accept="image/*" capture="environment" disabled={busy || left === 0} style={{ display: "none" }} onChange={e => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      <span className="item-meta">{left === null ? "" : `Restam ${left} de ${PHOTO_SEARCH_DAILY_LIMIT} pesquisas por fotografia hoje.`} A fotografia não fica guardada.</span>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {preview && <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
      <img src={preview} alt="A sua fotografia" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 12 }} />
      {result && <div className="stack" style={{ gap: 8 }}>
        {result.found ? <>
          <strong style={{ fontSize: 20 }}>Parece ser: {result.label}</strong>
          <div className="chips">{result.keywords.map(k => <a key={k} className="chip" href={"/explorar?q=" + encodeURIComponent(k)}>🔍 {k}</a>)}</div>
        </> : <strong>Não conseguimos reconhecer um artigo nesta fotografia. Tente outra, mais perto e com boa luz.</strong>}
      </div>}
    </div>}
    {items && <>
      <h2>{total ? `${total} resultado(s)` : "Ainda não há nada parecido à venda."}</h2>
      {!total && <p>Experimente as palavras acima na pesquisa, ou <a href="/pesquisas-guardadas">guarde uma pesquisa</a> para receber alertas.</p>}
      <div className="results-grid">
        {items.listings.map(x => <ItemCard key={x.id} video={!!x.video_url} href={"/classificados/" + x.id} media={x.media} title={x.title} price={formatPrice(x.price, x.currency)}
          icon={LISTING_ICON[x.listing_type] ?? "🏷️"} tag={x.purpose === "auction" ? "Leilão" : x.purpose !== "sale" ? PURPOSE_LABELS[x.purpose as keyof typeof PURPOSE_LABELS] : undefined} tagRed={x.purpose === "auction"} meta={timeAgo(x.created_at)} />)}
        {items.products.map(p => <ItemCard key={p.id} href={"/loja/" + p.id} media={p.media} title={p.name} price={formatPrice(p.price, p.currency)} tag="Loja" meta={[p.seller_name, p.municipality_name].filter(Boolean).join(" · ")} />)}
      </div>
    </>}
  </main>;
}
