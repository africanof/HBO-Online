import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { listMyFollows, toggleFollow, followHref, friendlyErrorIn, FOLLOW_KIND_LABELS, type MyFollow } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Message } from "../components/Ui";
import { LiteImage } from "../components/LiteImage";
import { useT } from "../lib/i18n";

export default function Seguindo() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<MyFollow[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listMyFollows(supabase()); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []));
  async function stop(f: MyFollow) {
    const r = await toggleFollow(supabase(), f.kind, f.id);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("ls.follow.stopped", { name: f.name })); await load(); }
  }
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></View>;
  if (!uid) return <View style={ui.screen}><Text style={ui.h1}>{t("more.following")}</Text><Button title={t("auth.login")} onPress={() => router.push("/login")} /></View>;
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/conta" style={ui.link}>← {t("account.title")}</Link>
    <Text style={ui.h1}>👥 {t("more.following")}</Text>
    <Text style={ui.text}>{t("ls.follow.intro")}</Text>
    <Message error={error} ok={notice} />
    {items.length === 0 && <Text style={ui.text}>{t("ls.follow.none")}</Text>}
    {items.map(f => <View key={f.kind + f.id} style={ui.card}>
      <View style={[ui.row, { alignItems: "center", flexWrap: "nowrap" }]}>
        {f.picture ? <LiteImage placeholder={f.kind === "business" ? "🏪" : "👤"} source={{ uri: f.picture }} style={{ width: 56, height: 56, borderRadius: f.kind === "business" ? 12 : 28 }} />
          : <Text style={{ fontSize: 40 }}>{f.kind === "business" ? "🏪" : f.kind === "provider" ? "🧰" : "👤"}</Text>}
        <View style={{ flex: 1 }}><Text style={ui.h2}>{f.name}</Text><Text style={ui.muted}>{tc(FOLLOW_KIND_LABELS[f.kind])}{f.detail ? " · " + f.detail : ""}</Text></View>
      </View>
      <Button title={t("ls.view")} variant="secondary" onPress={() => router.push(followHref(f.kind, f.id) as any)} />
      <Button title={t("ls.follow.unfollow")} variant="secondary" onPress={() => void stop(f)} />
    </View>)}
  </ScrollView>;
}
