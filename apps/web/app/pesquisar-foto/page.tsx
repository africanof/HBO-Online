"use client";
import { useEffect, useState } from "react";
import { analyzePhoto, photoSearchesLeft, photoSearchMessage, searchByKeywords, fitWithin, formatPrice,
  PHOTO_SEARCH_DAILY_LIMIT, PURPOSE_LABELS, type PhotoSearchResult, listingPriceLabel, isFeatured } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { ItemCard, LISTING_ICON } from "../../components/ItemCard";
import { useT, timeAgoIn } from "../../lib/i18n";

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
  const { lang, t, tc } = useT();
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
      if (r.error || !r.data) { setError(tc(photoSearchMessage(r.error ?? "PHOTO_SEARCH_FAILED"))); return; }
      setResult(r.data); setLeft(r.data.remaining);
      if (r.data.found) setItems(await searchByKeywords(supabase(), r.data.keywords));
    } catch { setError(tc(photoSearchMessage("INVALID_IMAGE"))); }
    finally { setBusy(false); }
  }

  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main className="stack"><a href="/">← {t("nav.home")}</a><h1>📷 {t("hdr.photo_search")}</h1>
    <p>{t("ls.photo_search_intro_short")}</p>
    <p><a className="btn" href="/conta/login?voltar=/pesquisar-foto">{t("ls.sign_in_to_search")}</a></p></main>;

  const total = items ? items.listings.length + items.products.length : 0;
  return <main className="stack">
    <a href="/">← {t("nav.home")}</a>
    <h1>📷 {t("hdr.photo_search")}</h1>
    <p>{t("ls.photo_search_intro")}</p>
    <div className="card">
      <label className="btn" style={{ justifySelf: "start", cursor: busy ? "wait" : "pointer" }}>
        {busy ? t("ls.analysing_photo") : "📷 " + t("ls.take_or_pick_photo")}
        <input type="file" accept="image/*" capture="environment" disabled={busy || left === 0} style={{ display: "none" }} onChange={e => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      <span className="item-meta">{left === null ? "" : t("ls.photo_searches_left", { n: left, max: PHOTO_SEARCH_DAILY_LIMIT })} {t("ls.photo_not_stored")}</span>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {preview && <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
      <img src={preview} alt={t("ls.your_photo")} style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 12 }} />
      {result && <div className="stack" style={{ gap: 8 }}>
        {result.found ? <>
          <strong style={{ fontSize: 20 }}>{t("ls.looks_like", { label: result.label })}</strong>
          <div className="chips">{result.keywords.map(k => <a key={k} className="chip" href={"/explorar?q=" + encodeURIComponent(k)}>🔍 {k}</a>)}</div>
        </> : <strong>{t("ls.photo_not_recognised")}</strong>}
      </div>}
    </div>}
    {items && <>
      <h2>{total ? t("ls.n_results", { n: total }) : t("ls.nothing_similar")}</h2>
      {!total && <p>{t("ls.try_words_above")} <a href="/pesquisas-guardadas">{t("ls.save_a_search")}</a> {t("ls.to_get_alerts")}</p>}
      <div className="results-grid">
        {items.listings.map(x => <ItemCard key={x.id} featured={isFeatured(x)} video={!!x.video_url} href={"/classificados/" + x.id} media={x.media} title={x.title} price={listingPriceLabel(x)}
          icon={LISTING_ICON[x.listing_type] ?? "🏷️"} tag={x.purpose === "auction" ? t("purpose.auction") : x.purpose !== "sale" ? t("purpose." + x.purpose) : undefined} tagRed={x.purpose === "auction"} meta={timeAgoIn(x.created_at, lang)} />)}
        {items.products.map(p => <ItemCard key={p.id} href={"/loja/" + p.id} media={p.media} title={p.name} price={formatPrice(p.price, p.currency)} tag={t("nav.shop")} meta={[p.seller_name, p.municipality_name].filter(Boolean).join(" · ")} />)}
      </div>
    </>}
  </main>;
}
