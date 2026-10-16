import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { Alert, ScrollView, Text, View } from "react-native";
import { listMyOffers, withdrawOffer, offerLabel, friendlyErrorIn, OFFER_STATUS_LABELS, type MyOffer } from "@huambo-online/core";
import { currentUserId, supabase } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Message } from "../components/Ui";
import { useT, formatDateTimeIn } from "../lib/i18n";

export default function Propostas() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<MyOffer[] | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listMyOffers(supabase()); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []));
  function withdraw(id: string) {
    Alert.alert(t("ls.offers.withdraw"), t("ls.sure"), [{ text: t("ls.no"), style: "cancel" }, { text: t("ls.offers.withdraw_short"), style: "destructive", onPress: async () => {
      const r = await withdrawOffer(supabase(), id);
      if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("ls.offers.withdrawn")); await load(); }
    } }]);
  }
  if (uid === undefined) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></ScrollView>;
  if (!uid) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>{t("ls.offers.title")}</Text><Button title={t("auth.login")} onPress={() => router.push("/login")} /></ScrollView>;
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/conta" style={ui.link}>← {t("account.title")}</Link>
    <Text style={ui.h1}>💬 {t("ls.offers.title")}</Text>
    <Text style={ui.text}>{t("ls.offers.intro")}</Text>
    <Message error={error} ok={notice} />
    {items === null && !error && <Text style={ui.text}>{t("common.loading")}</Text>}
    {items?.length === 0 && <Text style={ui.text}>{t("ls.offers.empty")}</Text>}
    {items?.map(o => <View key={o.id} style={ui.card}>
      <Link href={("/classificados/" + o.listing_id) as any} style={ui.link}>{o.listing_title} →</Link>
      <Text style={ui.h2}>{tc(offerLabel(o))}</Text>
      <Text style={ui.label}>{tc(OFFER_STATUS_LABELS[o.status])}</Text>
      {!!o.seller_note && <Text style={ui.text}>{t("ls.offers.seller_reply", { note: o.seller_note })}</Text>}
      <Text style={ui.muted}>{formatDateTimeIn(o.created_at, lang)}</Text>
      {o.status === "pending" && <Button title={t("ls.offers.withdraw")} variant="secondary" onPress={() => withdraw(o.id)} />}
    </View>)}
  </ScrollView>;
}
