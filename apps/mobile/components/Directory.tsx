import { PlaceView } from "./Place";
import { useEffect, useState } from "react";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Image, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { listProviders, listBusinesses, getProvider, getBusiness, listProviderServices, listReviewsFor, submitReview, contactDirectoryOwner,
  listDirectoryCategories, listProvinces, listMunicipalities, ratingLabel, whatsappLink, recordItemEvent, formatPrice, friendlyErrorIn, LANG_TAGS, type ReviewTarget, categoryLabel,
  listProviderReviews, getUserStats, getBusinessStats, userStatsRows, businessStatsRows, memberSince , categoryIdFromSlug, directoryHeading, FUEL_CATEGORY_SLUG, venueKindFromSlug, venueForBusiness, VENUE_KINDS } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui, C } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { SaveButton, ShareButton, FollowButton, useRecordView } from "./Engage";
import { StatsBlock, StarPicker, RequestServiceBox, VerifiedTag, stars } from "./Reputation";
import { ReportButton, TrustBadges, ReviewReply } from "./Trust";
import { PortfolioGallery, BusinessProducts } from "./Portfolio";
import { PromoShelf } from "./Promo";
import { LiteImage } from "./LiteImage";
import { InspectedBadge, useInspected } from "./Inspection";
import { ProfileQr } from "./ProfileQr";
import { inspectionKindFor } from "@huambo-online/core";
import { useT, coreText } from "../lib/i18n";

type Kind = "providers" | "businesses";
type Option = { id: string; name: string; slug?: string | null };
const TEXT = {
  providers: { title: "sv.dir_prov_title", search: "sv.dir_prov_search", empty: "sv.dir_prov_empty", base: "/profissionais", cta: "sv.dir_prov_cta", ctaHref: "/conta/profissional" },
  businesses: { title: "sv.dir_biz_title", search: "sv.dir_biz_search", empty: "sv.dir_biz_empty", base: "/empresas", cta: "sv.dir_biz_cta", ctaHref: "/conta/empresas" }
};

export function useTerritory() {
  const [provinces, setProvinces] = useState<Option[]>([]);
  const [municipalities, setMunicipalities] = useState<Option[]>([]);
  const [provinceId, setProvinceId] = useState("");
  useEffect(() => { void listProvinces(supabase()).then(({ data }) => { const l = (data ?? []) as Option[]; setProvinces(l); if (l.length === 1) setProvinceId(l[0].id); }); }, []);
  useEffect(() => { if (!provinceId) { setMunicipalities([]); return; } void listMunicipalities(supabase(), provinceId).then(({ data }) => setMunicipalities((data ?? []) as Option[])); }, [provinceId]);
  return { provinces, municipalities, provinceId, setProvinceId };
}

export function DirectoryList({ kind }: { kind: Kind }) {
  const params = useLocalSearchParams<{ q?: string; categoria?: string }>();
  const { t, tc, lang } = useT();
  const k = TEXT[kind]; const head = kind === "businesses" ? directoryHeading(params.categoria) : null;
  const tx = { ...k, title: head ? tc(head.title) : t(k.title), cta: head ? tc(head.cta) : t(k.cta), search: t(k.search), empty: t(k.empty) };
  const router = useRouter();
  const [q, setQ] = useState(params.q ?? ""); const [categoryId, setCategoryId] = useState(""); const [municipalityId, setMunicipalityId] = useState(""); const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<Option[]>([]); const { municipalities } = useTerritory();
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");
  const badges = useInspected(inspectionKindFor(kind), (items ?? []).map(x => kind === "providers" ? x.user_id : x.id));

  useEffect(() => {
    void listDirectoryCategories(supabase(), kind).then(({ data }) => {
      const list = (data ?? []) as Option[]; setCategories(list);
      const cat = categoryIdFromSlug(list, params.categoria); setCategoryId(cat);
      void search(cat);
    });
  }, []);
  async function search(category = categoryId) {
    setError("");
    const f = { query: q, categoryId: category, municipalityId };
    const r: any = kind === "providers" ? await listProviders(supabase(), f) : await listBusinesses(supabase(), f);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems(r.data ?? []);
  }

  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Text style={ui.h1}>{tx.title}</Text>
    <Button title={tx.cta} variant="secondary" onPress={() => router.push(tx.ctaHref as any)} />
    <TextInput value={q} onChangeText={setQ} placeholder={tx.search} style={ui.input} returnKeyType="search" onSubmitEditing={() => void search()} />
    <Button title={showFilters ? t("sv.hide_filters") : t("sv.filters")} variant="secondary" onPress={() => setShowFilters(!showFilters)} />
    {showFilters && <View style={{ gap: 10 }}>
      <Text style={ui.label}>{t("sv.category")}</Text>
      <Chips options={[{ value: "", label: t("sv.f_all") }, ...categories.map(c => ({ value: c.id, label: c.name }))]} value={categoryId} onChange={setCategoryId} />
      <Text style={ui.label}>{t("sv.municipality")}</Text>
      <Chips options={[{ value: "", label: t("sv.f_all_m") }, ...municipalities.map(m => ({ value: m.id, label: m.name }))]} value={municipalityId} onChange={setMunicipalityId} />
    </View>}
    <Button title={t("sv.search")} onPress={() => void search()} />
    <Message error={error} />
    {kind === "businesses" && categories.find(c => c.id === categoryId)?.slug === FUEL_CATEGORY_SLUG &&
      <Button title={t("sv.dir_fuel")} onPress={() => router.push("/combustivel" as any)} />}
    {kind === "businesses" && (() => { const vk = venueKindFromSlug(categories.find(c => c.id === categoryId)?.slug); return vk ? <Button title={t("sv.dir_venue", { icon: VENUE_KINDS[vk].icon, label: tc(VENUE_KINDS[vk].label) })} onPress={() => router.push(("/reservas?tipo=" + VENUE_KINDS[vk].slug) as any)} /> : null; })()}
    {items?.length === 0 && <Text style={ui.text}>{tx.empty}</Text>}
    <View style={{ backgroundColor: C.yellowSoft, borderRadius: 16, padding: 14, gap: 8 }}>
      <Text style={ui.text}><Text style={{ fontWeight: "800" }}>{t("sv.dir_not_found")}</Text>{t("sv.dir_not_found_text")}</Text>
      <Button title={t("sv.dir_post_wanted")} onPress={() => router.push("/classificados/publicar?finalidade=wanted" as any)} />
    </View>
    {items?.map(x => {
      const id = kind === "providers" ? x.user_id : x.id;
      const pic = kind === "providers" ? x.avatar_url : x.logo_url;
      return <Pressable key={id} style={ui.card} accessibilityRole="link" onPress={() => router.push(`${tx.base}/${id}` as any)}>
        {pic ? <LiteImage placeholder={kind === "providers" ? "👤" : "🏪"} source={{ uri: pic }} style={{ width: 56, height: 56, borderRadius: kind === "providers" ? 28 : 12 }} /> : <Text style={{ fontSize: 36 }}>{kind === "providers" ? "👷" : "🏢"}</Text>}
        <Text style={ui.h2}>{kind === "providers" ? x.display_name : x.name}{x.verified ? " ✔️" : ""}</Text>
        <InspectedBadge info={badges[id]} />
        {!!(kind === "providers" ? x.headline : x.description) && <Text style={ui.text}>{String(kind === "providers" ? x.headline : x.description).slice(0, 120)}</Text>}
        <Text style={ui.muted}>{[x.category_name, x.municipality_name].filter(Boolean).join(" · ")}</Text>
        <Text style={ui.text}>{coreText(ratingLabel(x.rating, x.review_count), t)}</Text>
      </Pressable>;
    })}
  </ScrollView>;
}

export function DirectoryDetail({ kind, id }: { kind: Kind; id: string }) {
  const router = useRouter(); const { t, tc, lang } = useT();
  const target: ReviewTarget = kind === "providers" ? { providerId: id } : { businessId: id };
  const [item, setItem] = useState<any>(null); const [services, setServices] = useState<any[]>([]); const [reviews, setReviews] = useState<any[]>([]);
  const badge = useInspected(inspectionKindFor(kind), [id]);
  const [uid, setUid] = useState<string | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [stats, setStats] = useState<{ rows: { label: string; value: string }[]; since: string }>({ rows: [], since: "" });
  const [venue, setVenue] = useState<{ id: string; status: string } | null>(null);
  const [message, setMessage] = useState(""); const [rating, setRating] = useState(0); const [comment, setComment] = useState(""); const [busy, setBusy] = useState(false);

  async function load() {
    const c = supabase();
    const r: any = kind === "providers" ? await getProvider(c, id) : await getBusiness(c, id);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    if (!r.data) { setError(t("sv.not_found")); return; }
    setItem(r.data);
    if (kind === "businesses") void venueForBusiness(c, id).then(v => setVenue(v.data)).catch(() => setVenue(null));
    if (kind === "providers") { const s = await listProviderServices(c, id); setServices(s.data ?? []); }
    const rv = await listProviderReviews(c, target);
    if (rv.error) { const old = await listReviewsFor(c, target); setReviews((old.data as any[]) ?? []); } else setReviews(rv.data);
    if (kind === "providers") { const st = await getUserStats(c, id); const rows = userStatsRows(st.data).filter(r => /serviço|Serviços|vendedor/.test(r.label));
      setStats({ rows: rows.length ? rows : [{ label: t("sv.services_done"), value: "0" }], since: tc(memberSince(st.data?.member_since)) }); }
    else { const st = await getBusinessStats(c, id); setStats({ rows: businessStatsRows(st.data), since: lang === "pt" ? memberSince(st.data?.member_since).replace("Membro", "No Huambo Online") : tc(memberSince(st.data?.member_since)) }); }
    const u = await c.auth.getUser(); setUid(u.data.user?.id ?? null);
  }
  useEffect(() => { if (id) void load(); }, [id]);
  const viewKind = kind === "providers" ? "provider" : "business";
  useRecordView(viewKind, item ? id : undefined, item ? (kind === "providers" ? item.display_name : item.name) : undefined, item?.avatar_url ?? item?.logo_url ?? null);

  async function contact() {
    if (!uid) { setError(t("sv.msg_login")); return; }
    setBusy(true); setError("");
    const r = await contactDirectoryOwner(supabase(), target, message); setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    router.push(("/mensagens?conversation=" + (r.data as any)?.id) as any);
  }
  async function review() {
    if (!uid) { setError(t("sv.review_login")); return; }
    setBusy(true); setError(""); setNotice("");
    const r = await submitReview(supabase(), target, rating, comment); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("sv.review_thanks")); setComment(""); await load(); }
  }

  if (error && !item) return <View style={ui.screen}><Link href={TEXT[kind].base as any} style={ui.link}>{t("sv.back")}</Link><Text style={ui.error}>{error}</Text></View>;
  if (!item) return <View style={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></View>;
  const mine = uid === (kind === "providers" ? item.user_id : item.owner_id);
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const wa = whatsappLink(item.whatsapp, t("sv.wa_hello_profile"));

  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href={TEXT[kind].base as any} style={ui.link}>{t("sv.back")}</Link>
    {!!(item.avatar_url || item.logo_url) && <Image source={{ uri: item.avatar_url || item.logo_url }} style={{ width: 96, height: 96, borderRadius: 20 }} accessibilityLabel={kind === "providers" ? t("sv.photo") : t("sv.logo")} />}
    <Text style={ui.h1}>{kind === "providers" ? item.display_name : item.name}{item.verified ? " ✔️" : ""}</Text>
    <InspectedBadge info={badge[id]} big />
    {kind === "providers" && !!item.headline && <Text style={ui.text}>{item.headline}</Text>}
    <Text style={ui.muted}>{[categoryLabel(item), item.municipalities?.name, item.address_text].filter(Boolean).join(" · ")}</Text>
    {!!item.markets?.name && <Link href={("/pracas/" + item.markets.id) as any} style={ui.link}>{t("sv.in_market", { name: item.markets.name })}</Link>}
    <Text style={ui.label}>{coreText(ratingLabel(avg, reviews.length), t)}</Text>
    <TrustBadges userId={kind === "providers" ? id : item.owner_id} />
    <StatsBlock rows={stats.rows.map(r => ({ label: tc(r.label), value: tc(r.value) }))} footer={stats.since} />
    {!!(item.bio || item.description) && <Text style={ui.text}>{item.bio || item.description}</Text>}
    <PlaceView directions={item.directions} lat={item.geo_lat} lng={item.geo_lng} />
    {!!item.phone && <Button title={t("sv.call")} variant="secondary" onPress={() => { void recordItemEvent(supabase(), viewKind, id, "call"); void Linking.openURL("tel:" + item.phone.replace(/\s/g, "")); }} />}
    {!!wa && <Button title="WhatsApp" variant="secondary" onPress={() => { void recordItemEvent(supabase(), viewKind, id, "whatsapp"); void Linking.openURL(wa); }} />}
    {kind === "businesses" && venue?.status === "approved" && !mine && <Button title={t("sv.book_venue")} onPress={() => router.push(("/reservas/" + venue.id) as any)} />}
    {kind === "businesses" && mine && <Button title={venue ? t("sv.manage_bookings") : t("sv.receive_bookings")} variant="secondary" onPress={() => router.push((venue ? `/reservas/${venue.id}/gerir` : "/reservas/painel") as any)} />}
    {mine && <Button title={t("common.edit")} onPress={() => router.push((kind === "providers" ? "/conta/profissional" : "/conta/empresas") as any)} />}
    <FollowButton kind={kind === "providers" ? "provider" : "business"} id={id} mine={mine} />
    {!mine && <SaveButton kind={viewKind} id={id} />}
    <ShareButton kind={viewKind} id={id} title={kind === "providers" ? item.display_name : item.name} />
    <ProfileQr kind={kind === "providers" ? "profissionais" : "empresas"} id={id} name={(kind === "providers" ? item.display_name : item.name) ?? ""} />
    {kind === "providers" && services.length > 0 && <View style={{ gap: 8 }}><Text style={ui.h2}>{t("sv.services")}</Text>
      {services.map(s => <View key={s.id} style={ui.card}><Text style={ui.label}>{s.title}</Text>{!!s.description && <Text style={ui.text}>{s.description}</Text>}<Text style={ui.text}>{s.price_from != null ? t("sv.price_from_cap", { price: formatPrice(s.price_from, s.currency) }) : t("price.on_request")}</Text></View>)}
    </View>}
    <PromoShelf kind={kind === "providers" ? "provider" : "business"} id={id} />
    <PortfolioGallery target={kind === "providers" ? { providerId: id } : { businessId: id }} />
    {kind === "businesses" && <BusinessProducts ownerId={item.owner_id} businessId={id} />}
    <Message error={error} ok={notice} />
    {!mine && <RequestServiceBox target={target} signedIn={!!uid} />}
    {!mine && <View style={ui.card}>
      <Text style={ui.h2}>{t("sv.send_message")}</Text>
      <TextInput style={[ui.input, ui.area]} multiline value={message} onChangeText={setMessage} placeholder={t("sv.msg_ph_quote")} />
      <Button title={busy ? t("sv.sending") : t("sv.send_message")} disabled={busy || !message.trim()} onPress={() => void contact()} />
    </View>}
    <Text style={ui.h2}>{t("sv.reviews")}</Text>
    {!mine && <View style={ui.card}>
      <StarPicker value={rating} onChange={setRating} />
      <TextInput style={[ui.input, ui.area]} multiline value={comment} onChangeText={setComment} placeholder={t("sv.review_ph")} />
      <Button title={t("sv.publish_review")} disabled={busy || !rating} onPress={() => void review()} />
    </View>}
    {reviews.length === 0 && <Text style={ui.text}>{t("sv.no_reviews")}</Text>}
    {reviews.map(r => <View key={r.id} style={ui.card}><Text style={ui.label}>{stars(r.rating)} — {r.author_name}</Text>{r.confirmed && <VerifiedTag text={t("sv.service_confirmed")} />}{!!r.comment && <Text style={ui.text}>{r.comment}</Text>}<Text style={ui.muted}>{new Date(r.created_at).toLocaleDateString(LANG_TAGS[lang])}</Text>
      <ReviewReply kind="service" reviewId={r.id} reply={r.owner_reply} canReply={mine} onDone={() => void load()} /></View>)}
    {!mine && <ReportButton type={kind === "providers" ? "provider" : "business"} id={id} label={kind === "providers" ? t("sv.report_provider") : t("sv.report_business")} />}
  </ScrollView>;
}
