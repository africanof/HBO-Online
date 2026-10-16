"use client";
import { useEffect, useState } from "react";
import { Gallery } from "../../../components/Video";
import { useParams } from "next/navigation";
import { getProduct, addToMyCart, formatRef, getPublicProfile, formatPrice, friendlyErrorIn } from "@huambo-online/core";
import { supabase } from "../../../lib/supabase";
import { SaveButton, ShareButton, SellerWhatsApp, FollowButton, useRecordView } from "../../../components/Engage";
import { SellerBadge } from "../../../components/Reputation";
import { ReportButton } from "../../../components/Trust";
import { useT } from "../../../lib/i18n";

export default function Produto() {
  const { id } = useParams<{ id: string }>();
  const { lang, t } = useT();
  const [p, setP] = useState<any>(null); const [seller, setSeller] = useState(""); const [uid, setUid] = useState<string | null>(null);
  const [qty, setQty] = useState(1); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!id) return; void (async () => {
    const c = supabase(); const r = await getProduct(c, id);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    if (!r.data) { setError(t("sh.prod.not_found")); return; }
    setP(r.data);
    const s = await getPublicProfile(c, r.data.seller_id); if (s.data?.full_name) setSeller(s.data.full_name);
    const u = await c.auth.getUser(); setUid(u.data.user?.id ?? null);
  })(); }, [id]);
  useRecordView("product", p ? id : undefined, p?.name, Array.isArray(p?.media) ? p.media[0] : null);

  async function add() {
    if (!uid) { window.location.href = "/conta/login?voltar=/loja/" + id; return; }
    setBusy(true); setError(""); setNotice("");
    const r = await addToMyCart(supabase(), id, qty); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setNotice(t("sh.prod.added"));
  }
  if (error && !p) return <main><a href="/loja">← {t("nav.shop")}</a><p className="error">{error}</p></main>;
  if (!p) return <main><p>{t("common.loading")}</p></main>;
  const media: string[] = Array.isArray(p.media) ? p.media : [];
  const mine = uid === p.seller_id;
  return <main className="stack">
    <a href="/loja">← {t("nav.shop")}{p.categories?.name ? " › " + p.categories.name : ""}</a>
    <div className="itempage">
      <Gallery media={media} video={p.video_url} icon={"📦"} title={p.name} />
      <section className="buybox">
        <h1>{p.name}</h1>
        {seller && <div className="seller-box"><span aria-hidden style={{ fontSize: 30 }}>🏪</span><span>{t("sh.seller")}: <a href={"/vendedor/" + p.seller_id}><strong>{seller}</strong></a> <SellerBadge userId={p.seller_id} /><br /><a href={"/vendedor/" + p.seller_id} style={{ fontWeight: 400, fontSize: 15 }}>{t("sh.prod.see_seller_shop")}</a></span></div>}
        {seller && !mine && <div className="row"><FollowButton kind="seller" id={p.seller_id} /></div>}
        <div className="big-price">{formatPrice(p.price, p.currency)}</div>
        <dl className="facts">
          {p.ref_no && <><dt>{t("sh.prod.ref")}</dt><dd><strong>{formatRef("product", p.ref_no)}</strong></dd></>}
          <dt>{t("sh.prod.available")}</dt><dd style={{ color: p.stock > 0 ? "var(--ok)" : "var(--danger)" }}>{p.stock > 0 ? t("sh.in_stock", { n: p.stock }) : t("sh.sold_out")}</dd>
          {p.categories?.name && <><dt>{t("sh.category")}</dt><dd>{p.categories.name}</dd></>}
          {p.municipalities?.name && <><dt>{t("sh.prod.place")}</dt><dd>📍 {p.municipalities.name}</dd></>}
          {p.markets?.name && <><dt>{t("sh.market")}</dt><dd>🧺 <a href={"/pracas/" + p.markets.id}>{p.markets.name}</a></dd></>}
          <dt>{t("sh.delivery")}</dt><dd>🛵 {t("sh.prod.delivery_how")}</dd>
        </dl>
        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="ok" role="status">{notice} <a href="/carrinho">{t("sh.prod.see_cart")} →</a></p>}
        <div className="actions">
          {mine ? <a className="btn" href="/conta/produtos">{t("sh.prod.manage")}</a> : p.stock > 0 && <>
            <label style={{ maxWidth: 160 }}>{t("sh.quantity")}<input type="number" min={1} max={p.stock} value={qty} onChange={e => setQty(Math.max(1, Math.min(p.stock, Number(e.target.value) || 1)))} /></label>
            <button disabled={busy} onClick={add}>🛒 {t("sh.prod.add_cart")}</button>
          </>}
          {!mine && <SellerWhatsApp sellerId={p.seller_id} kind="product" id={id} title={p.name} refCode={p.ref_no ? formatRef("product", p.ref_no) : null} />}
          {!mine && <SaveButton kind="product" id={id} />}
          <ShareButton kind="product" id={id} title={p.name} extra={{ price: p.price, currency: p.currency, refCode: p.ref_no ? formatRef("product", p.ref_no) : null, place: p.municipalities?.name }} />
        </div>
      </section>
    </div>
    {p.description && <section className="card"><h2 style={{ margin: 0 }}>{t("sh.description")}</h2><p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{p.description}</p></section>}
    {!mine && <ReportButton type="product" id={id} label={t("sh.prod.report")} />}
  </main>;
}
