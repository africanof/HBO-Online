import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { ScrollView, Text } from "react-native";
import { listPendingReviews, friendlyErrorIn, type PendingReview } from "@huambo-online/core";
import { currentUserId, supabase } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Message } from "../components/Ui";
import { DealReviewForm } from "../components/Reputation";
import { useT } from "../lib/i18n";

export default function Avaliacoes() {
  const router = useRouter(); const { t, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<PendingReview[] | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listPendingReviews(supabase()); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []));
  if (uid === undefined) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></ScrollView>;
  if (!uid) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>{t("ls.np.reviews")}</Text><Text style={ui.text}>{t("ls.reviews.sign_in")}</Text><Button title={t("auth.login")} onPress={() => router.push("/login")} /></ScrollView>;
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>← {t("account.title")}</Link>
    <Text style={ui.h1}>{t("ls.reviews.title")}</Text>
    <Text style={ui.text}>{t("ls.reviews.intro")}</Text>
    <Message error={error} ok={notice} />
    {items === null && !error && <Text style={ui.text}>{t("common.loading")}</Text>}
    {items?.length === 0 && <Text style={ui.text}>{t("ls.reviews.none")}</Text>}
    {items?.map(it => <DealReviewForm key={it.kind + it.ref_id} item={it} onDone={() => { setNotice(t("ls.reviews.thanks")); void load(); }} />)}
    <Link href={("/vendedor/" + uid) as any} style={ui.link}>{t("ls.reviews.received")}</Link>
  </ScrollView>;
}
