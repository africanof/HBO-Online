import { useCallback, useState } from "react";
import { usePull } from "../components/Pull";
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Image, ScrollView, Text, View } from "react-native";
import { listMyClassifiedListings, deleteClassifiedListing, updateClassifiedStatus, publishClassifiedListing, removeClassifiedMedia,
  formatPrice, friendlyErrorIn, STATUS_LABELS, myOfferCounts, saleModeBadges, listingPriceLabel, formatRef, listMyBoosts, getPlatformSettings, type MyBoost, type PlatformSettings } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Message } from "../components/Ui";
import { DealCloser } from "../components/Reputation";
import { LiteImage } from "../components/LiteImage";
import { BoostBox } from "../components/Boosts";
import { useT, coreText } from "../lib/i18n";

export default function MeusAnuncios() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const params = useLocalSearchParams<{ erro?: string }>();
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState(params.erro ? t("ls.mine.draft_error", { error: tc(params.erro) }) : "");
  const [busy, setBusy] = useState(""); const [notice, setNotice] = useState(""); const [offers, setOffers] = useState<Record<string, number>>({});
  const [uid, setUid] = useState(""); const [boosts, setBoosts] = useState<MyBoost[]>([]); const [settings, setSettings] = useState<PlatformSettings | null>(null);

  async function load() {
    const uid = await currentUserId();
    if (!uid) { setError(t("ls.mine.sign_in")); setItems([]); return; }
    const r = await listMyClassifiedListings(supabase(), uid);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data ?? []);
    setOffers((await myOfferCounts(supabase())).data);
    setUid(uid);
    const [b, s] = await Promise.all([listMyBoosts(supabase()), getPlatformSettings(supabase())]); setBoosts(b.data); setSettings(s.data);
  }
  useFocusEffect(useCallback(() => { void load(); }, []));
  const pull = usePull(load);

  async function act(id: string, fn: () => Promise<{ error: any }>) {
    setBusy(id); setError("");
    const r = await fn(); setBusy("");
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else await load();
  }

  function confirmDelete(x: any) {
    Alert.alert(t("ls.mine.delete_title"), t("ls.sure_undo"), [{ text: t("common.cancel"), style: "cancel" }, { text: t("common.delete"), style: "destructive", onPress: () => void act(x.id, async () => { const r = await deleteClassifiedListing(supabase(), x.id); if (!r.error) await removeClassifiedMedia(supabase(), x.media ?? []); return r; }) }]);
  }

  return <ScrollView contentContainerStyle={ui.screen} refreshControl={pull}>
    <Link href="/" style={ui.link}>← Huambo Online</Link>
    <Text style={ui.h1}>{t("more.my_listings")}</Text>
    <Button title={t("ls.mine.stats")} variant="secondary" onPress={() => router.push("/conta/estatisticas" as any)} />
    <Button title={t("home.post_listing")} onPress={() => router.push("/classificados/publicar" as any)} />
    <Message error={error} ok={notice} />
    {items === null && <Text style={ui.text}>{t("common.loading")}</Text>}
    {items?.length === 0 && !error && <Text style={ui.text}>{t("ls.mine.empty")}</Text>}
    {items?.map(x => <View key={x.id} style={ui.card}>
      {Array.isArray(x.media) && x.media[0] && <LiteImage source={{ uri: x.media[0] }} style={{ width: "100%", height: 160, borderRadius: 10 }} />}
      <Text style={ui.h2}>{x.title}</Text>
      {!!x.ref_no && <Text style={ui.muted}>{t("ls.ref_no", { ref: formatRef("listing", x.ref_no) })}</Text>}
      <Text style={ui.text}>{tc(STATUS_LABELS[x.status as keyof typeof STATUS_LABELS] ?? x.status)} · {tc(coreText(listingPriceLabel(x), t) ?? "")}{saleModeBadges(x).map(b => " · " + tc(coreText(b, t) ?? b)).join("")}</Text>
      {offers[x.id] > 0 && <Link href={("/classificados/" + x.id) as any} style={ui.link}>{t("ls.mine.offers_waiting", { n: offers[x.id] })}</Link>}
      {!!uid && <BoostBox listing={x} uid={uid} boosts={boosts} settings={settings} onDone={msg => { setNotice(msg); void load(); }} />}
      {!!x.deal_with && <Link href={"/avaliacoes" as any} style={ui.link}>{t("ls.mine.deal_review")}</Link>}
      <View style={{ gap: 8 }}>
        <Button title={t("ls.view")} variant="secondary" onPress={() => router.push(("/classificados/" + x.id) as any)} />
        <Button title={t("common.edit")} variant="secondary" onPress={() => router.push(`/classificados/${x.id}/editar` as any)} />
        {x.status === "published"
          ? <Button title={t("ls.pause")} variant="secondary" disabled={busy === x.id} onPress={() => void act(x.id, () => updateClassifiedStatus(supabase(), x.id, "paused"))} />
          : <Button title={t("ls.publish")} disabled={busy === x.id} onPress={() => void act(x.id, () => publishClassifiedListing(supabase(), x.id))} />}
        {["published", "sold", "rented", "closed"].includes(x.status) && <DealCloser listing={x} onDone={msg => { setNotice(msg); void load(); }} />}
        <Button title={t("common.delete")} variant="danger" disabled={busy === x.id} onPress={() => confirmDelete(x)} />
      </View>
    </View>)}
  </ScrollView>;
}
