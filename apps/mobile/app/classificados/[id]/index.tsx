import { ListingGuarantee } from "../../../components/Conformity";
import { TranslateListing } from "../../../components/AiTools";
import { PlaceView } from "../../../components/Place";
import { useEffect, useRef, useState } from "react";
import { VideoPlayer } from "../../../components/Video";
import { WantedHelpers } from "../../../components/WantedHelpers";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Image, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { saleModeBadges, buyerOptions, SALE_MODE_INFO, type SaleMode, loadItemWithCache, isOfflineError, getClassifiedListing, contactListingOwner, isClassifiedListingSaved, saveClassifiedListing, removeClassifiedListing,
  reportClassifiedListing, getPublicProfile, AUCTIONABLE_TYPES, formatRef, formatPrice, friendlyErrorIn, listingTerritory, LISTING_TYPE_LABELS, PURPOSE_LABELS, STATUS_LABELS, listingPriceLabel, wantedReplyMessage, isFeatured, readAgro, agroSummary, categoryOf, isJobCategorySlug, trackListingView, salaryLabel, type JobCategory } from "@huambo-online/core";
import { DetailFacts } from "../../../components/ListingDetails";
import { supabase } from "../../../lib/supabase";
import { ui, C } from "../../../lib/ui";
import { Button, Message, SmallButton } from "../../../components/Ui";
import { SafetyTipsBox } from "../../../components/Safety";
import { ShareButton, SellerWhatsApp, useRecordView, deviceStore } from "../../../components/Engage";
import { OfflineBanner } from "../../../components/Offline";
import { RentalRequestForm, AuctionPanel } from "../../../components/ListingExtras";
import { MarketLink } from "../../../components/MarketPicker";
import { SellerBadge } from "../../../components/Reputation";
import { OfferBox, OffersList } from "../../../components/Offers";
import { ProtectedBuyBox } from "../../../components/ProtectedBuy";
import { ListingInspection } from "../../../components/ItemInspection";
import { isExampleName } from "@huambo-online/core";
import { PhotoGallery } from "../../../components/PhotoGallery";
import { DeliveryPolicyBox } from "../../../components/Delivery";
import { useT, coreText } from "../../../lib/i18n";

export default function ClassifiedDetail() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<any>(null);
  const [tr, setTr] = useState<{ title: string; description: string | null } | null>(null);
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

  // Atalhos «Fazer proposta» e «Mensagem»: descem até à secção certa.
  const scroller = useRef<ScrollView>(null); const spots = useRef<Record<string, number>>({});
  const mark = (k: string) => (e: { nativeEvent: { layout: { y: number } } }) => { spots.current[k] = e.nativeEvent.layout.y; };
  const go = (k: string) => scroller.current?.scrollTo({ y: Math.max(0, (spots.current[k] ?? 0) - 12), animated: true });
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

  const typeLabel = tc(LISTING_TYPE_LABELS[item.listing_type as keyof typeof LISTING_TYPE_LABELS] ?? item.listing_type);
  const purposeLabel = tc(PURPOSE_LABELS[item.purpose as keyof typeof PURPOSE_LABELS] ?? item.purpose);
  const priceText = item.purpose === "wanted" ? t("home.budget") + " " + tc(coreText(listingPriceLabel(item), t) ?? "") : job ? t("job.salary") + ": " + tc(salaryLabel(item.price, job.slug, item.currency)) : tc(coreText(listingPriceLabel(item), t) ?? "");
  const tag = { alignSelf: "flex-start" as const, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, overflow: "hidden" as const };

  // Como nas APPs dos grandes marketplaces: fotografias primeiro, depois o essencial (preço e comprar), as ações
  // lado a lado, os detalhes numa tabela e, no fim, a proposta, a mensagem e o «Denunciar».
  return <ScrollView ref={scroller} contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/explorar" style={ui.link}>← {t("nav.explore")}</Link>
    <OfflineBanner show={offline.on} savedAt={offline.at} />
    {item.status !== "published" && <Text style={ui.error}>{t("ls.detail.only_you", { status: tc(STATUS_LABELS[item.status as keyof typeof STATUS_LABELS] ?? item.status) })}</Text>}
    <PhotoGallery media={media} icon={item.purpose === "wanted" ? "🔎" : "🏷️"} />
    {!!item.video_url && <VideoPlayer url={item.video_url} />}

    <View style={[ui.card, { gap: 10 }]}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {item.purpose === "wanted" && <Text style={[ui.label, tag, { backgroundColor: C.yellowSoft }]}>{t("ls.detail.wanted_badge")}</Text>}
        {isFeatured(item) && <Text style={[ui.label, tag, { backgroundColor: "#FFF4D6", color: "#4A3700", borderColor: "#E0B100", borderWidth: 1 }]}>{t("card.featured")}</Text>}
        {badges.map(b => <Text key={b} style={[tag, { backgroundColor: C.blueSoft, color: C.blueText, fontWeight: "800" }]}>{tc(coreText(b, t) ?? b)}</Text>)}
      </View>
      {isExampleName(item.title) && <Text style={[ui.text, { fontWeight: "800", color: C.red }]}>{t("pp.example_note")}</Text>}
      <Text style={ui.h1}>{tr?.title ?? item.title}</Text>
      <Text style={ui.muted}>{[item.ref_no ? formatRef("listing", item.ref_no) : null, typeLabel + " · " + purposeLabel, place ? "📍 " + place : null].filter(Boolean).join("  ·  ")}</Text>
      <Text style={[ui.price, { fontSize: 30 }]}>{priceText}</Text>
      {!!job && <Text style={ui.text}>{t("job.detail_hint")}</Text>}
      {!!item.trade_wants && <Text style={ui.text}>{t("ls.detail.trade_for")} <Text style={ui.label}>{item.trade_wants}</Text></Text>}
      <Message error={error} ok={notice} />
      {mine ? <>
        <Button title={t("ls.edit.title")} onPress={() => router.push(`/classificados/${id}/editar` as any)} />
        <Button title={t("more.my_listings")} variant="secondary" onPress={() => router.push("/meus-anuncios" as any)} />
      </> : <>
        <ProtectedBuyBox item={item} uid={uid} isJob={!!job} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {item.purpose === "wanted"
            ? <SmallButton primary title={item.listing_type === "service" ? t("ls.detail.can_do") : t("ls.detail.have_it")} onPress={() => { if (!message) setMessage(tc(wantedReplyMessage(item.title, item.listing_type === "service"))); go("contact"); }} />
            : (can.offerMoney || can.offerTrade) && <SmallButton title={item.sale_mode === "trade" ? t("act.trade") : t("act.offer")} onPress={() => go("offer")} />}
          <SmallButton title={t("act.message")} onPress={() => go("contact")} />
          <SmallButton title={savedId ? t("act.saved") : t("act.save")} onPress={() => void toggleSaved()} disabled={busy} />
          {item.status === "published" && <ShareButton compact kind="listing" id={id} title={item.title} extra={{ price: item.purpose === "wanted" ? null : item.price, currency: item.currency, refCode: item.ref_no ? formatRef("listing", item.ref_no) : null, place }} />}
        </View>
        {item.status === "published" && <SellerWhatsApp sellerId={item.owner_id} kind="listing" id={id} title={item.title} refCode={item.ref_no ? formatRef("listing", item.ref_no) : null} />}
      </>}
      {!!seller && <Pressable accessibilityRole="link" onPress={() => router.push(("/vendedor/" + item.owner_id) as any)}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.blueSoft, alignItems: "center", justifyContent: "center" }}><Text style={{ color: C.blueText, fontWeight: "800", fontSize: 18 }}>{seller.trim().charAt(0).toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={ui.muted}>{item.purpose === "wanted" ? t("ls.detail.buyer", { name: "" }).replace(/[:：\s]+$/, "") : t("ls.detail.advertiser", { name: "" }).replace(/[:：\s]+$/, "")}</Text>
          <Text style={[ui.label, { color: C.blue }]}>{seller} →</Text>
          <SellerBadge userId={item.owner_id} />
        </View>
      </Pressable>}
      {item.status === "published" && <TranslateListing listingId={item.id} onTranslated={setTr} />}
    </View>

    {item.status === "published" && <AuctionPanel listingId={id} uid={uid} mine={mine} canStart={["sale", "auction"].includes(item.purpose) && AUCTIONABLE_TYPES.includes(item.listing_type)} />}
    {!mine && item.status === "published" && ["rent", "lease"].includes(item.purpose) && <RentalRequestForm listingId={id} uid={uid} defaultPrice={item.price} />}

    <View style={[ui.card, { gap: 8 }]}>
      <Text style={ui.h2}>{t("ls.details")}</Text>
      <DetailFacts listingType={item.listing_type} attributes={item.attributes} categorySlug={catSlug} />
      {!!mode && !!SALE_MODE_INFO[mode] && <Text style={ui.text}>{SALE_MODE_INFO[mode].icon} {tc(SALE_MODE_INFO[mode].label)}</Text>}
      {!!readAgro(item.attributes) && <Link href={"/agricultura" as any} style={ui.link}>{agroSummary(readAgro(item.attributes)!).split(" · ").map(p => tc(p)).join(" · ")}</Link>}
      <MarketLink id={item.market_id} />
    </View>
    {!!item.description && <View style={[ui.card, { gap: 6 }]}><Text style={ui.h2}>{t("ls.description_t")}</Text><Text style={ui.text}>{tr?.description ?? item.description}</Text></View>}
    {item.purpose === "wanted" && item.status === "published" && <WantedHelpers title={item.title} mine={mine} />}
    {item.purpose !== "wanted" && !job && <ListingInspection listingId={id} listingType={item.listing_type} mine={mine} uid={uid} />}
    {item.purpose !== "wanted" && <DeliveryPolicyBox sellerId={item.owner_id} />}
    <PlaceView directions={item.directions} lat={item.geo_lat} lng={item.geo_lng} approximate />
    <ListingGuarantee listingId={id} uid={uid} mine={mine} wanted={item.purpose === "wanted"} />
    {mine && item.purpose !== "wanted" && item.purpose !== "auction" && <OffersList listingId={id} price={item.price} />}
    {!mine && <>
      {(can.offerMoney || can.offerTrade) && <View onLayout={mark("offer")}><OfferBox listingId={id} uid={uid} offerMoney={can.offerMoney} offerTrade={can.offerTrade} tradeOnly={item.sale_mode === "trade"} tradeWants={item.trade_wants} price={item.price} currency={item.currency} /></View>}
      <View style={ui.card} onLayout={mark("contact")}>
        <Text style={ui.h2}>{item.purpose === "wanted" ? t("ls.detail.reply_buyer") : t("ls.detail.contact")}</Text>
        <TextInput value={message} onChangeText={setMessage} placeholder={t("ls.detail.msg_ph")} multiline style={[ui.input, ui.area]} />
        <Button title={busy ? t("ls.sending") : t("ls.detail.send_msg")} onPress={() => void contact()} disabled={busy || !message.trim()} />
      </View>
      <SafetyTipsBox />
      {!reporting ? <Pressable accessibilityRole="button" onPress={() => setReporting(true)} hitSlop={8} style={{ alignSelf: "flex-start", paddingVertical: 6 }}>
        <Text style={[ui.muted, { fontWeight: "700" }]}>{t("act.report")}</Text></Pressable> : <View style={ui.card}>
        <Text style={ui.label}>{t("ls.detail.reason")}</Text>
        <TextInput value={reason} onChangeText={setReason} multiline style={[ui.input, ui.area]} placeholder={t("ls.detail.reason_ph")} />
        <Button title={t("ls.detail.send_report")} variant="danger" onPress={() => void report()} />
        <Button title={t("common.cancel")} variant="secondary" onPress={() => setReporting(false)} />
      </View>}
    </>}
  </ScrollView>;
}
