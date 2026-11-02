"use client";
import { useEffect, useState } from "react";
import { Gallery } from "../../../components/Video";
import { TranslateListing } from "../../../components/AiTools";
import { WantedHelpers } from "../../../components/WantedHelpers";
import { useParams } from "next/navigation";
import { saleModeBadges, buyerOptions, buyNowMessage, SALE_MODE_INFO, type SaleMode, loadItemWithCache, isOfflineError, getClassifiedListing, contactListingOwner, isClassifiedListingSaved, saveClassifiedListing, removeClassifiedListing,
  reportClassifiedListing, getPublicProfile, formatPrice, friendlyErrorIn, listingTerritory, LISTING_TYPE_LABELS, PURPOSE_LABELS, STATUS_LABELS, listingPriceLabel, wantedReplyMessage, isFeatured, readAgro, agroSummary, idFromParam } from "@huambo-online/core";
import { supabase } from "../../../lib/supabase";
import { useT } from "../../../lib/i18n";
import { SafetyTipsBox } from "../../../components/Safety";
import { PlaceView } from "../../../components/Place";
import { DeliveryPolicyBox } from "../../../components/SellerDelivery";
import { ListingGuarantee } from "../../../components/Conformity";
import { ShareButton, SellerWhatsApp, useRecordView, browserStore } from "../../../components/Engage";
import { OfflineBanner } from "../../../components/Offline";
import { RentalRequestForm, AuctionPanel } from "../../../components/ListingExtras";
import { MarketFact } from "../../../components/MarketPicker";
import { DetailFacts } from "../../../components/ListingDetails";
import { AUCTIONABLE_TYPES, formatRef, categoryOf, isJobCategorySlug, trackListingView, salaryLabel, type JobCategory } from "@huambo-online/core";
import { SellerBadge } from "../../../components/Reputation";
import { OfferBox, OffersList } from "../../../components/Offers";

export default function ClassifiedDetail() {
  const { id: rawId } = useParams<{ id: string }>();
  // Aceita também o endereço com o nome do artigo: «/…/<id>-nome-do-artigo».
  const id = idFromParam(rawId);
  const { lang, t, tc } = useT();
  const [item, setItem] = useState<any>(null);
  const [tr, setTr] = useState<{ title: string; description: string | null } | null>(null);
  const [job, setJob] = useState<JobCategory | null>(null); const [catSlug, setCatSlug] = useState<string | undefined>();
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

  // Vaga de emprego ou estágio: o preço é o salário e o CV vai pelas Mensagens.
  useEffect(() => { void categoryOf(supabase(), item?.category_id).then(c => { setCatSlug(c?.slug); setJob(c && isJobCategorySlug(c.slug) ? (c as JobCategory) : null); }).catch(() => setJob(null)); }, [item?.category_id]);
  useEffect(() => {
    if (!id) return;
    void (async () => {
      const c = supabase();
      // Os anúncios abertos ficam guardados para se poderem ver quando a rede falhar.
      const r = await loadItemWithCache<any>(browserStore, "anuncios", id, () => getClassifiedListing(c, id));
      setOffline({ on: r.fromCache || isOfflineError(r.error), at: r.savedAt });
      if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
      if (!r.data) { setError(t("ls.listing_not_found")); return; }
      setItem(r.data);
      if (r.fromCache) return;
      if (r.data.status === "published") void trackListingView(c, id); // recomendações «Para si»
      const terr = listingTerritory(r.data);
      if (terr.municipalityId) {
        const m = await c.from("municipalities").select("name,provinces(name)").eq("id", terr.municipalityId).maybeSingle();
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
    if (!uid) { setError(t("ls.login_to_save")); return; }
    setBusy(true);
    const c = supabase();
    const r = savedId ? await removeClassifiedListing(c, uid, id) : await saveClassifiedListing(c, uid, id);
    setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setSavedId(savedId ? null : (r.data as any)?.id ?? "saved");
  }

  async function contact() {
    if (!uid) { setError(t("ls.login_to_contact")); return; }
    if (!message.trim() || busy) return;
    setBusy(true); setError("");
    const r = await contactListingOwner(supabase(), id, message);
    setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    setMessage("");
    const conversationId = (r.data as any)?.id;
    if (conversationId) window.location.href = "/mensagens?conversation=" + conversationId;
    else setNotice(t("ls.message_sent"));
  }

  async function buyNow() {
    if (!uid) { setError(t("ls.login_to_buy")); return; }
    setBusy(true); setError("");
    const r = await contactListingOwner(supabase(), id, buyNowMessage(item.title, item.price, item.currency));
    setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    const conversationId = (r.data as any)?.id;
    if (conversationId) window.location.href = "/mensagens?conversation=" + conversationId; else setNotice(t("ls.buy_request_sent"));
  }

  async function report() {
    if (!uid) { setError(t("ls.login_to_report")); return; }
    if (!reason.trim()) { setError(t("ls.report_need_reason")); return; }
    const r = await reportClassifiedListing(supabase(), id, reason);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("ls.report_sent")); setReporting(false); setReason(""); }
  }

  if (error && !item) return <main><a href="/explorar">← {t("nav.explore")}</a><h1>{t("ls.listing")}</h1><p className="error">{error}</p></main>;
  if (!item) return <main><p>{t("ls.loading_listing")}</p></main>;
  const media: string[] = Array.isArray(item.media) ? item.media : [];
  const mine = uid === item.owner_id;
  const badges = saleModeBadges(item);
  const can = buyerOptions(item);
  const mode = (item.purpose === "auction" ? "auction" : item.sale_mode) as SaleMode | null;

  const typeLabel = tc(LISTING_TYPE_LABELS[item.listing_type as keyof typeof LISTING_TYPE_LABELS] ?? item.listing_type);
  const purposeLabel = tc(PURPOSE_LABELS[item.purpose as keyof typeof PURPOSE_LABELS] ?? item.purpose);

  return <main className="stack">
    <a href={"/explorar?tipo=" + item.listing_type}>← {t("scope.classificados")} › {typeLabel}</a>
    <OfflineBanner show={offline.on} savedAt={offline.at} />
    {item.status !== "published" && <p className="badge">{tc(STATUS_LABELS[item.status as keyof typeof STATUS_LABELS] ?? item.status)} — {t("ls.only_you_see")}</p>}
    <div className="itempage">
      <Gallery media={media} video={item.video_url} icon={item.purpose === "wanted" ? "🔎" : "🏷️"} title={item.title} />
      <section className="buybox">
        {item.purpose === "wanted" && <span className="badge" style={{ justifySelf: "start", background: "var(--yellow-soft)", borderColor: "var(--yellow-line)", color: "var(--yellow-text)" }}>🔎 {t("home.wanted_badge")} — {t("ls.buyer_request")}</span>}
        {isFeatured(item) && <span className="badge" style={{ justifySelf: "start", background: "var(--yellow-soft)", borderColor: "var(--yellow-line)", color: "var(--yellow-text)" }}>⭐ {t("ls.featured")}</span>}
        <h1>{tr?.title ?? item.title}</h1>
        {item.status === "published" && <TranslateListing listingId={item.id} onTranslated={setTr} />}
        {seller && <div className="seller-box"><span aria-hidden style={{ fontSize: 30 }}>👤</span><span>{item.purpose === "wanted" ? t("ls.buyer") : t("ls.advertiser")}: <a href={"/vendedor/" + item.owner_id}><strong>{seller}</strong></a> <SellerBadge userId={item.owner_id} /><br /><a href={"/vendedor/" + item.owner_id} style={{ fontWeight: 400, fontSize: 15 }}>{t("ls.see_other_listings")}</a></span></div>}
        {item.purpose === "wanted" ? <div><span className="muted">{t("ls.budget")}</span><div className="big-price">{tc(listingPriceLabel(item))}</div></div> : job ? <div><span className="muted">{t("job.salary")}</span><div className="big-price">{tc(salaryLabel(item.price, job.slug, item.currency))}</div></div>
          : <div className="big-price">{tc(listingPriceLabel(item))}</div>}
        {job && <p className="scam-warn" style={{ margin: 0 }}>{t("job.detail_hint")}</p>}
        {badges.length > 0 && <div className="row">{badges.map(b => <span key={b} className="mode-badge">{tc(b)}</span>)}</div>}
        {item.trade_wants && <p style={{ margin: 0 }}>🔁 {t("ls.accepts_trade")} <strong>{item.trade_wants}</strong></p>}
        <dl className="facts">
          <DetailFacts listingType={item.listing_type} attributes={item.attributes} categorySlug={catSlug} />
          {item.ref_no && <><dt>{t("ls.listing_no")}</dt><dd><strong>{formatRef("listing", item.ref_no)}</strong></dd></>}
          <dt>{t("ls.type")}</dt><dd>{typeLabel}</dd>
          {readAgro(item.attributes) && <><dt>{t("ls.from_farm")}</dt><dd><a href="/agricultura">{tc(agroSummary(readAgro(item.attributes)!))}</a></dd></>}
          <dt>{t("ls.purpose")}</dt><dd>{purposeLabel}</dd>
          {mode && SALE_MODE_INFO[mode] && <><dt>{t("ls.how_sells")}</dt><dd>{SALE_MODE_INFO[mode].icon} {tc(SALE_MODE_INFO[mode].label)}</dd></>}
          {place && <><dt>{t("ls.location")}</dt><dd>📍 {place}</dd></>}
          <MarketFact id={item.market_id} />
        </dl>
        {notice && <p className="ok" role="status">{notice}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {item.status === "published" && <AuctionPanel listingId={id} uid={uid} mine={mine} canStart={["sale", "auction"].includes(item.purpose) && AUCTIONABLE_TYPES.includes(item.listing_type)} />}
        {!mine && item.status === "published" && ["rent", "lease"].includes(item.purpose) && <RentalRequestForm listingId={id} uid={uid} defaultPrice={item.price} />}
        <div className="actions">
          {mine ? <><a className="btn" href={`/classificados/${id}/editar`}>{t("ls.edit_listing")}</a><a className="btn secondary" href="/meus-anuncios">{t("ft.my_ads")}</a></> : <>
            {item.purpose === "wanted"
              ? <a className="btn" href="#contactar" onClick={() => { if (!message.trim()) setMessage(wantedReplyMessage(item.title, item.listing_type === "service")); }}>{item.listing_type === "service" ? "🛠️ " + t("ls.i_can_do_service") : "✋ " + t("ls.i_have_it")}</a>
              : <>
                {can.buyNow && <button type="button" onClick={buyNow} disabled={busy}>🛒 {item.price != null ? t("ls.want_buy_for", { price: formatPrice(item.price, item.currency) }) : t("ls.want_buy")}</button>}
                {(can.offerMoney || can.offerTrade) && <a className={can.buyNow ? "btn secondary" : "btn"} href="#proposta">{item.sale_mode === "trade" ? "🔁 " + t("ls.offer_propose_trade") : "💬 " + t("ls.offer_make")}</a>}
                <a className={can.buyNow || can.offerMoney || can.offerTrade ? "btn secondary" : "btn"} href="#contactar">✉️ {t("ls.contact_advertiser")}</a>
                {item.status === "published" && <SellerWhatsApp sellerId={item.owner_id} kind="listing" id={id} title={item.title} refCode={item.ref_no ? formatRef("listing", item.ref_no) : null} />}
              </>}
            <button type="button" className="secondary" onClick={toggleSaved} disabled={busy}>{savedId ? "♥ " + t("ls.saved") : "♡ " + t("ls.save_listing")}</button>
          </>}
          {item.status === "published" && <ShareButton kind="listing" id={id} title={item.title} extra={{ price: item.purpose === "wanted" ? null : item.price, currency: item.currency, refCode: item.ref_no ? formatRef("listing", item.ref_no) : null, place }} />}
        </div>
        {item.purpose !== "wanted" && <DeliveryPolicyBox sellerId={item.owner_id} />}
      </section>
    </div>
    {item.purpose === "wanted" && item.status === "published" && <WantedHelpers title={item.title} mine={mine} />}
    {item.description && <section className="card"><h2 style={{ margin: 0 }}>{t("ls.description")}</h2><p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{tr?.description ?? item.description}</p></section>}
    <PlaceView directions={item.directions} lat={item.geo_lat} lng={item.geo_lng} approximate />
    <ListingGuarantee listingId={id} uid={uid} mine={mine} wanted={item.purpose === "wanted"} />
    {mine && item.purpose !== "wanted" && item.purpose !== "auction" && <OffersList listingId={id} />}
    {!mine && <>
      {(can.offerMoney || can.offerTrade) && <OfferBox listingId={id} uid={uid} offerMoney={can.offerMoney} offerTrade={can.offerTrade} tradeOnly={item.sale_mode === "trade"} tradeWants={item.trade_wants} />}
      <SafetyTipsBox />
      <section className="card" id="contactar">
        <h2 style={{ margin: 0 }}>{item.purpose === "wanted" ? t("ls.reply_buyer") : t("ls.contact_advertiser")}</h2>
        <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder={t("ls.ph_contact")} rows={4} />
        <button type="button" disabled={busy || !message.trim()} onClick={contact} style={{ justifySelf: "start" }}>{busy ? t("ls.sending") : t("ls.send_message")}</button>
      </section>
      {!reporting ? <button type="button" className="secondary" onClick={() => setReporting(true)} style={{ justifySelf: "start" }}>{t("ls.report_listing")}</button> :
        <section className="card"><label>{t("ls.report_reason")}<textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder={t("ls.ph_report")} /></label>
          <div className="row"><button type="button" className="danger" onClick={report}>{t("ls.report_send")}</button><button type="button" className="secondary" onClick={() => setReporting(false)}>{t("common.cancel")}</button></div></section>}
    </>}
  </main>;
}
