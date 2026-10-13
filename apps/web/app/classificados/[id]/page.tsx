"use client";
import { useEffect, useState } from "react";
import { Gallery } from "../../../components/Video";
import { WantedHelpers } from "../../../components/WantedHelpers";
import { useParams } from "next/navigation";
import { saleModeBadges, buyerOptions, buyNowMessage, SALE_MODE_INFO, type SaleMode, loadItemWithCache, isOfflineError, getClassifiedListing, contactListingOwner, isClassifiedListingSaved, saveClassifiedListing, removeClassifiedListing,
  reportClassifiedListing, getPublicProfile, formatPrice, friendlyError, listingTerritory, LISTING_TYPE_LABELS, PURPOSE_LABELS, STATUS_LABELS, listingPriceLabel, wantedReplyMessage, isFeatured, readAgro, agroSummary } from "@huambo-online/core";
import { supabase } from "../../../lib/supabase";
import { SafetyTipsBox } from "../../../components/Safety";
import { PlaceView } from "../../../components/Place";
import { ListingGuarantee } from "../../../components/Conformity";
import { ShareButton, SellerWhatsApp, useRecordView, browserStore } from "../../../components/Engage";
import { OfflineBanner } from "../../../components/Offline";
import { RentalRequestForm, AuctionPanel } from "../../../components/ListingExtras";
import { MarketFact } from "../../../components/MarketPicker";
import { AUCTIONABLE_TYPES, formatRef } from "@huambo-online/core";
import { SellerBadge } from "../../../components/Reputation";
import { OfferBox, OffersList } from "../../../components/Offers";

export default function ClassifiedDetail() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<any>(null);
  const [place, setPlace] = useState("");
  const [seller, setSeller] = useState("");
  const [uid, setUid] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [offline, setOffline] = useState<{ on: boolean; at: number | null }>({ on: false, at: null });
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const c = supabase();
      // Os anúncios abertos ficam guardados para se poderem ver quando a rede falhar.
      const r = await loadItemWithCache<any>(browserStore, "anuncios", id, () => getClassifiedListing(c, id));
      setOffline({ on: r.fromCache || isOfflineError(r.error), at: r.savedAt });
      if (r.error) { setError(friendlyError(r.error)); return; }
      if (!r.data) { setError("Anúncio não encontrado ou já não está publicado."); return; }
      setItem(r.data);
      if (r.fromCache) return;
      const t = listingTerritory(r.data);
      if (t.municipalityId) {
        const m = await c.from("municipalities").select("name,provinces(name)").eq("id", t.municipalityId).maybeSingle();
        if (m.data) setPlace(m.data.name + ((m.data as any).provinces?.name ? ", " + (m.data as any).provinces.name : ""));
      }
      const p = await getPublicProfile(c, r.data.owner_id);
      if (p.data?.full_name) setSeller(p.data.full_name);
      const u = await c.auth.getUser();
      if (u.data.user) {
        setUid(u.data.user.id);
        const s = await isClassifiedListingSaved(c, u.data.user.id, id);
        if (s.data) setSavedId(s.data.id);
      }
    })();
  }, [id]);

  useRecordView("listing", item?.status === "published" ? id : undefined, item?.title, Array.isArray(item?.media) ? item.media[0] : null);

  async function toggleSaved() {
    if (!uid) { setError("Inicie sessão para guardar este anúncio."); return; }
    setBusy(true);
    const c = supabase();
    const r = savedId ? await removeClassifiedListing(c, uid, id) : await saveClassifiedListing(c, uid, id);
    setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else setSavedId(savedId ? null : (r.data as any)?.id ?? "saved");
  }

  async function contact() {
    if (!uid) { setError("Inicie sessão para contactar o anunciante."); return; }
    if (!message.trim() || busy) return;
    setBusy(true); setError("");
    const r = await contactListingOwner(supabase(), id, message);
    setBusy(false);
    if (r.error) { setError(friendlyError(r.error)); return; }
    setMessage("");
    const conversationId = (r.data as any)?.id;
    if (conversationId) window.location.href = "/mensagens?conversation=" + conversationId;
    else setNotice("Mensagem enviada.");
  }

  async function buyNow() {
    if (!uid) { setError("Inicie sessão para comprar."); return; }
    setBusy(true); setError("");
    const r = await contactListingOwner(supabase(), id, buyNowMessage(item.title, item.price, item.currency));
    setBusy(false);
    if (r.error) { setError(friendlyError(r.error)); return; }
    const conversationId = (r.data as any)?.id;
    if (conversationId) window.location.href = "/mensagens?conversation=" + conversationId; else setNotice("Pedido de compra enviado ao vendedor.");
  }

  async function report() {
    if (!uid) { setError("Inicie sessão para denunciar."); return; }
    if (!reason.trim()) { setError("Indique o motivo da denúncia."); return; }
    const r = await reportClassifiedListing(supabase(), id, reason);
    if (r.error) setError(friendlyError(r.error)); else { setNotice("Denúncia enviada. Obrigado."); setReporting(false); setReason(""); }
  }

  if (error && !item) return <main><a href="/explorar">← Explorar</a><h1>Anúncio</h1><p className="error">{error}</p></main>;
  if (!item) return <main><p>A carregar anúncio…</p></main>;
  const media: string[] = Array.isArray(item.media) ? item.media : [];
  const mine = uid === item.owner_id;
  const badges = saleModeBadges(item);
  const can = buyerOptions(item);
  const mode = (item.purpose === "auction" ? "auction" : item.sale_mode) as SaleMode | null;

  const typeLabel = LISTING_TYPE_LABELS[item.listing_type as keyof typeof LISTING_TYPE_LABELS] ?? item.listing_type;
  const purposeLabel = PURPOSE_LABELS[item.purpose as keyof typeof PURPOSE_LABELS] ?? item.purpose;

  return <main className="stack">
    <a href={"/explorar?tipo=" + item.listing_type}>← Classificados › {typeLabel}</a>
    <OfflineBanner show={offline.on} savedAt={offline.at} />
    {item.status !== "published" && <p className="badge">{STATUS_LABELS[item.status as keyof typeof STATUS_LABELS] ?? item.status} — só você vê este anúncio</p>}
    <div className="itempage">
      <Gallery media={media} video={item.video_url} icon={item.purpose === "wanted" ? "🔎" : "🏷️"} title={item.title} />
      <section className="buybox">
        {item.purpose === "wanted" && <span className="badge" style={{ justifySelf: "start", background: "var(--yellow-soft)", borderColor: "var(--yellow-line)", color: "var(--yellow-text)" }}>🔎 PROCURA-SE — pedido de comprador</span>}
        {isFeatured(item) && <span className="badge" style={{ justifySelf: "start", background: "var(--yellow-soft)", borderColor: "var(--yellow-line)", color: "var(--yellow-text)" }}>⭐ Destaque</span>}
        <h1>{item.title}</h1>
        {seller && <div className="seller-box"><span aria-hidden style={{ fontSize: 30 }}>👤</span><span>{item.purpose === "wanted" ? "Comprador" : "Anunciante"}: <a href={"/vendedor/" + item.owner_id}><strong>{seller}</strong></a> <SellerBadge userId={item.owner_id} /><br /><a href={"/vendedor/" + item.owner_id} style={{ fontWeight: 400, fontSize: 15 }}>Ver outros anúncios</a></span></div>}
        {item.purpose === "wanted" ? <div><span className="muted">Orçamento</span><div className="big-price">{listingPriceLabel(item)}</div></div> : <div className="big-price">{listingPriceLabel(item)}</div>}
        {badges.length > 0 && <div className="row">{badges.map(b => <span key={b} className="mode-badge">{b}</span>)}</div>}
        {item.trade_wants && <p style={{ margin: 0 }}>🔁 Aceita em troca: <strong>{item.trade_wants}</strong></p>}
        <dl className="facts">
          {item.ref_no && <><dt>N.º do anúncio</dt><dd><strong>{formatRef("listing", item.ref_no)}</strong></dd></>}
          <dt>Tipo</dt><dd>{typeLabel}</dd>
          {readAgro(item.attributes) && <><dt>Do campo</dt><dd><a href="/agricultura">{agroSummary(readAgro(item.attributes)!)}</a></dd></>}
          <dt>Finalidade</dt><dd>{purposeLabel}</dd>
          {mode && SALE_MODE_INFO[mode] && <><dt>Como vende</dt><dd>{SALE_MODE_INFO[mode].icon} {SALE_MODE_INFO[mode].label}</dd></>}
          {place && <><dt>Local</dt><dd>📍 {place}</dd></>}
          <MarketFact id={item.market_id} />
        </dl>
        {notice && <p className="ok" role="status">{notice}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {item.status === "published" && <AuctionPanel listingId={id} uid={uid} mine={mine} canStart={["sale", "auction"].includes(item.purpose) && AUCTIONABLE_TYPES.includes(item.listing_type)} />}
        {!mine && item.status === "published" && ["rent", "lease"].includes(item.purpose) && <RentalRequestForm listingId={id} uid={uid} defaultPrice={item.price} />}
        <div className="actions">
          {mine ? <><a className="btn" href={`/classificados/${id}/editar`}>Editar anúncio</a><a className="btn secondary" href="/meus-anuncios">Os meus anúncios</a></> : <>
            {item.purpose === "wanted"
              ? <a className="btn" href="#contactar" onClick={() => { if (!message.trim()) setMessage(wantedReplyMessage(item.title, item.listing_type === "service")); }}>{item.listing_type === "service" ? "🛠️ Posso fazer este serviço" : "✋ Tenho o que procura"}</a>
              : <>
                {can.buyNow && <button type="button" onClick={buyNow} disabled={busy}>🛒 Quero comprar{item.price != null ? " por " + formatPrice(item.price, item.currency) : ""}</button>}
                {(can.offerMoney || can.offerTrade) && <a className={can.buyNow ? "btn secondary" : "btn"} href="#proposta">{item.sale_mode === "trade" ? "🔁 Propor troca" : "💬 Fazer proposta"}</a>}
                <a className={can.buyNow || can.offerMoney || can.offerTrade ? "btn secondary" : "btn"} href="#contactar">✉️ Contactar anunciante</a>
                {item.status === "published" && <SellerWhatsApp sellerId={item.owner_id} kind="listing" id={id} title={item.title} refCode={item.ref_no ? formatRef("listing", item.ref_no) : null} />}
              </>}
            <button type="button" className="secondary" onClick={toggleSaved} disabled={busy}>{savedId ? "♥ Guardado" : "♡ Guardar anúncio"}</button>
          </>}
          {item.status === "published" && <ShareButton kind="listing" id={id} title={item.title} extra={{ price: item.purpose === "wanted" ? null : item.price, currency: item.currency, refCode: item.ref_no ? formatRef("listing", item.ref_no) : null, place }} />}
        </div>
      </section>
    </div>
    {item.purpose === "wanted" && item.status === "published" && <WantedHelpers title={item.title} mine={mine} />}
    {item.description && <section className="card"><h2 style={{ margin: 0 }}>Descrição</h2><p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{item.description}</p></section>}
    <PlaceView directions={item.directions} lat={item.geo_lat} lng={item.geo_lng} approximate />
    <ListingGuarantee listingId={id} uid={uid} mine={mine} wanted={item.purpose === "wanted"} />
    {mine && item.purpose !== "wanted" && item.purpose !== "auction" && <OffersList listingId={id} />}
    {!mine && <>
      {(can.offerMoney || can.offerTrade) && <OfferBox listingId={id} uid={uid} offerMoney={can.offerMoney} offerTrade={can.offerTrade} tradeOnly={item.sale_mode === "trade"} tradeWants={item.trade_wants} />}
      <SafetyTipsBox />
      <section className="card" id="contactar">
        <h2 style={{ margin: 0 }}>{item.purpose === "wanted" ? "Responder ao comprador" : "Contactar anunciante"}</h2>
        <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Olá, o anúncio ainda está disponível?" rows={4} />
        <button type="button" disabled={busy || !message.trim()} onClick={contact} style={{ justifySelf: "start" }}>{busy ? "A enviar…" : "Enviar mensagem"}</button>
      </section>
      {!reporting ? <button type="button" className="secondary" onClick={() => setReporting(true)} style={{ justifySelf: "start" }}>Denunciar anúncio</button> :
        <section className="card"><label>Motivo da denúncia<textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Ex.: fraude, conteúdo proibido…" /></label>
          <div className="row"><button type="button" className="danger" onClick={report}>Enviar denúncia</button><button type="button" className="secondary" onClick={() => setReporting(false)}>Cancelar</button></div></section>}
    </>}
  </main>;
}
