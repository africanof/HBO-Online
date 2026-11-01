import { ListingGuarantee } from "../../../components/Conformity";
import { PlaceView } from "../../../components/Place";
import { useEffect, useState } from "react";
import { VideoPlayer } from "../../../components/Video";
import { WantedHelpers } from "../../../components/WantedHelpers";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Image, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { saleModeBadges, buyerOptions, buyNowMessage, SALE_MODE_INFO, type SaleMode, loadItemWithCache, isOfflineError, getClassifiedListing, contactListingOwner, isClassifiedListingSaved, saveClassifiedListing, removeClassifiedListing,
  reportClassifiedListing, getPublicProfile, AUCTIONABLE_TYPES, formatRef, formatPrice, friendlyErrorIn, listingTerritory, LISTING_TYPE_LABELS, PURPOSE_LABELS, STATUS_LABELS, listingPriceLabel, wantedReplyMessage, isFeatured, readAgro, agroSummary, categoryOf, isJobCategorySlug, salaryLabel, type JobCategory } from "@huambo-online/core";
import { DetailFacts } from "../../../components/ListingDetails";
import { supabase } from "../../../lib/supabase";
import { ui, C } from "../../../lib/ui";
import { Button, Message } from "../../../components/Ui";
import { SafetyTipsBox } from "../../../components/Safety";
import { ShareButton, SellerWhatsApp, useRecordView, deviceStore } from "../../../components/Engage";
import { OfflineBanner } from "../../../components/Offline";
import { RentalRequestForm, AuctionPanel } from "../../../components/ListingExtras";
import { MarketLink } from "../../../components/MarketPicker";
import { SellerBadge } from "../../../components/Reputation";
import { OfferBox, OffersList } from "../../../components/Offers";
import { PhotoGallery } from "../../../components/PhotoGallery";
import { DeliveryPolicyBox } from "../../../components/Delivery";
import { useT, coreText } from "../../../lib/i18n";

export default function ClassifiedDetail() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<any>(null);
  const [job, setJob] = useState<JobCategory | null>(null); const [catSlug, setCatSlug] = useState<string | undefined>();
  // Vaga de emprego ou estágio: o preço é o salário e o CV vai pelas Mensagens.
  useEffect(() => { void categoryOf(supabase(), item?.category_id).then(c => { setCatSlug(c?.slug); setJob(c && isJobCategorySlug(c.slug) ? (c as JobCategory) : null); }).catch(() => setJob(null)); }, [item?.category_id]);
  const [place, setPlace] = useState("");
  const [seller, setSeller] = useState("");
  const [uid, setUid] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(0);
  const [reporting, setReporting] = useState(false);
  const [offline, setOffline] = useState<{ on: boolean; at: number | null }>({ on: false, at: null });
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const c = supabase();
      // Os anúncios abertos ficam guardados para se poderem ver sem internet.
      const r = await loadItemWithCache<any>(deviceStore, "anuncios", id, () => getClassifiedListing(c, id));
      setOffline({ on: r.fromCache || isOfflineError(r.error), at: r.savedAt });
      if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
      if (!r.data) { setError(t("ls.detail.not_found")); return; }
      setItem(r.data);
      if (r.fromCache) return;
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
    if (!uid) { setError(t("ls.detail.sign_in_save")); return; }
    setBusy(true);
    const c = supabase();
    const r = savedId ? await removeClassifiedListing(c, uid, id) : await saveClassifiedListing(c, uid, id);
    setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setSavedId(savedId ? null : (r.data as any)?.id ?? "saved");
  }

  async function contact() {
    if (!uid) { setError(t("ls.detail.sign_in_contact")); return; }
    if (!message.trim() || busy) return;
    setBusy(true); setError("");
    const r = await contactListingOwner(supabase(), id, message);
    setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    setMessage("");
    const conversationId = (r.data as any)?.id;
    if (conversationId) router.push(("/mensagens?conversation=" + conversationId) as any); else setNotice(t("ls.detail.msg_sent"));
  }

  async function buyNow() {
    if (!uid) { setError(t("ls.detail.sign_in_buy")); return; }
    setBusy(true); setError("");
    const r = await contactListingOwner(supabase(), id, tc(buyNowMessage(item.title, item.price, item.currency)));
    setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    const conversationId = (r.data as any)?.id;
    if (conversationId) router.push(("/mensagens?conversation=" + conversationId) as any); else setNotice(t("ls.detail.buy_sent"));
  }

  async function report() {
    if (!uid) { setError(t("ls.detail.sign_in_report")); return; }
    if (!reason.trim()) { setError(t("ls.detail.reason_needed")); return; }
    const r = await reportClassifiedListing(supabase(), id, reason);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("ls.detail.reported")); setReporting(false); setReason(""); }
  }

  if (error && !item) return <View style={ui.screen}><Link href="/explorar" style={ui.link}>← {t("nav.explore")}</Link><Text style={ui.error}>{error}</Text></View>;
  if (!item) return <View style={ui.screen}><Text style={ui.text}>{t("ls.detail.loading")}</Text></View>;
  const media: string[] = Array.isArray(item.media) ? item.media : [];
  const mine = uid === item.owner_id;
  const badges = saleModeBadges(item);
  const can = buyerOptions(item);
  const mode = (item.purpose === "auction" ? "auction" : item.sale_mode) as SaleMode | null;

  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/explorar" style={ui.link}>← {t("nav.explore")}</Link>
    <OfflineBanner show={offline.on} savedAt={offline.at} />
    {item.status !== "published" && <Text style={ui.error}>{t("ls.detail.only_you", { status: tc(STATUS_LABELS[item.status as keyof typeof STATUS_LABELS] ?? item.status) })}</Text>}
    {item.purpose === "wanted" && <Text style={[ui.label, { backgroundColor: C.yellowSoft, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }]}>{t("ls.detail.wanted_badge")}</Text>}
    {isFeatured(item) && <Text style={[ui.label, { alignSelf: "flex-start", backgroundColor: "#FFF4D6", color: "#4A3700", borderColor: "#E0B100", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 }]}>{t("card.featured")}</Text>}
    <Text style={ui.h1}>{item.title}</Text>
    {!!item.ref_no && <Text style={ui.muted}>{t("ls.detail.ref", { ref: formatRef("listing", item.ref_no) })}</Text>}
    {item.purpose === "wanted" ? <Text style={ui.price}>{t("home.budget")} {tc(coreText(listingPriceLabel(item), t) ?? "")}</Text> : job ? <Text style={ui.price}>{t("job.salary")}: {tc(salaryLabel(item.price, job.slug, item.currency))}</Text>
      : <Text style={ui.price}>{tc(coreText(listingPriceLabel(item), t) ?? "")}</Text>}
    {!!job && <Text style={ui.text}>{t("job.detail_hint")}</Text>}
    <DetailFacts listingType={item.listing_type} attributes={item.attributes} categorySlug={catSlug} />
    {badges.length > 0 && <View style={ui.row}>{badges.map(b => <Text key={b} style={{ backgroundColor: C.blueSoft, color: C.blueText, fontWeight: "800", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>{tc(coreText(b, t) ?? b)}</Text>)}</View>}
    {!!mode && !!SALE_MODE_INFO[mode] && <Text style={ui.muted}>{SALE_MODE_INFO[mode].icon} {tc(SALE_MODE_INFO[mode].label)}</Text>}
    {!!item.trade_wants && <Text style={ui.text}>{t("ls.detail.trade_for")} <Text style={ui.label}>{item.trade_wants}</Text></Text>}
    <Text style={ui.text}>{tc(LISTING_TYPE_LABELS[item.listing_type as keyof typeof LISTING_TYPE_LABELS] ?? item.listing_type)} · {tc(PURPOSE_LABELS[item.purpose as keyof typeof PURPOSE_LABELS] ?? item.purpose)}{place ? " · 📍 " + place : ""}</Text>
    {!!readAgro(item.attributes) && <Link href={"/agricultura" as any} style={ui.link}>{agroSummary(readAgro(item.attributes)!).split(" · ").map(p => tc(p)).join(" · ")}</Link>}
    {!!seller && <Link href={("/vendedor/" + item.owner_id) as any} style={ui.link}>{item.purpose === "wanted" ? t("ls.detail.buyer", { name: seller }) : t("ls.detail.advertiser", { name: seller })} →</Link>}
    {!!seller && <SellerBadge userId={item.owner_id} />}
    <MarketLink id={item.market_id} />
    <PhotoGallery media={media} icon={item.purpose === "wanted" ? "🔎" : "🏷️"} />
    {!!item.video_url && <VideoPlayer url={item.video_url} />}
    {item.purpose === "wanted" && item.status === "published" && <WantedHelpers title={item.title} mine={mine} />}
    {!!item.description && <Text style={ui.text}>{item.description}</Text>}
    <PlaceView directions={item.directions} lat={item.geo_lat} lng={item.geo_lng} approximate />
    {item.purpose !== "wanted" && <DeliveryPolicyBox sellerId={item.owner_id} />}
    <ListingGuarantee listingId={id} uid={uid} mine={mine} wanted={item.purpose === "wanted"} />
    {item.status === "published" && <ShareButton kind="listing" id={id} title={item.title} extra={{ price: item.purpose === "wanted" ? null : item.price, currency: item.currency, refCode: item.ref_no ? formatRef("listing", item.ref_no) : null, place }} />}
    {item.status === "published" && <AuctionPanel listingId={id} uid={uid} mine={mine} canStart={["sale", "auction"].includes(item.purpose) && AUCTIONABLE_TYPES.includes(item.listing_type)} />}
    {!mine && item.status === "published" && ["rent", "lease"].includes(item.purpose) && <RentalRequestForm listingId={id} uid={uid} defaultPrice={item.price} />}
    <Message error={error} ok={notice} />
    {mine ? <View style={{ gap: 10 }}>
      <Button title={t("ls.edit.title")} onPress={() => router.push(`/classificados/${id}/editar` as any)} />
      <Button title={t("more.my_listings")} variant="secondary" onPress={() => router.push("/meus-anuncios" as any)} />
      {item.purpose !== "wanted" && item.purpose !== "auction" && <OffersList listingId={id} />}
    </View> : <View style={{ gap: 12 }}>
      {item.status === "published" && <SellerWhatsApp sellerId={item.owner_id} kind="listing" id={id} title={item.title} refCode={item.ref_no ? formatRef("listing", item.ref_no) : null} />}
      {can.buyNow && <Button title={item.price != null ? t("ls.detail.buy_for", { price: formatPrice(item.price, item.currency) }) : t("ls.detail.buy")} disabled={busy} onPress={() => void buyNow()} />}
      {(can.offerMoney || can.offerTrade) && <OfferBox listingId={id} uid={uid} offerMoney={can.offerMoney} offerTrade={can.offerTrade} tradeOnly={item.sale_mode === "trade"} tradeWants={item.trade_wants} />}
      <Button title={savedId ? t("ls.detail.saved") : t("ls.detail.save")} variant="secondary" onPress={() => void toggleSaved()} disabled={busy} />
      <SafetyTipsBox />
      <View style={ui.card}>
        <Text style={ui.h2}>{item.purpose === "wanted" ? t("ls.detail.reply_buyer") : t("ls.detail.contact")}</Text>
        {item.purpose === "wanted" && !message && <Button title={item.listing_type === "service" ? t("ls.detail.can_do") : t("ls.detail.have_it")} onPress={() => setMessage(tc(wantedReplyMessage(item.title, item.listing_type === "service")))} />}
        <TextInput value={message} onChangeText={setMessage} placeholder={t("ls.detail.msg_ph")} multiline style={[ui.input, ui.area]} />
        <Button title={busy ? t("ls.sending") : t("ls.detail.send_msg")} onPress={() => void contact()} disabled={busy || !message.trim()} />
      </View>
      {!reporting ? <Button title={t("ls.detail.report")} variant="secondary" onPress={() => setReporting(true)} /> : <View style={ui.card}>
        <Text style={ui.label}>{t("ls.detail.reason")}</Text>
        <TextInput value={reason} onChangeText={setReason} multiline style={[ui.input, ui.area]} placeholder={t("ls.detail.reason_ph")} />
        <Button title={t("ls.detail.send_report")} variant="danger" onPress={() => void report()} />
        <Button title={t("common.cancel")} variant="secondary" onPress={() => setReporting(false)} />
      </View>}
    </View>}
  </ScrollView>;
}
