import { useCallback, useState } from "react";
import { usePull } from "../components/Pull";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { Image, ScrollView, Text, View } from "react-native";
import { listMySaved, toggleSaved, itemHref, friendlyErrorIn, SAVED_KIND_LABELS, type SavedKind } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";
import { LiteImage } from "../components/LiteImage";
import { useT } from "../lib/i18n";

export default function Guardados() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<any[]>([]); const [kind, setKind] = useState<SavedKind | "">(""); const [error, setError] = useState("");
  async function load() { const r = await listMySaved(supabase()); if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems((r.data as any[]) ?? []); }
  const pull = usePull(load);
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []));
  async function remove(x: any) { if (!uid) return; const r = await toggleSaved(supabase(), uid, x.kind, x.target_id, x.id); if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems(a => a.filter(i => i.id !== x.id)); }
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></View>;
  if (!uid) return <View style={ui.screen}><Text style={ui.h1}>{t("nav.saved")}</Text><Text style={ui.text}>{t("ls.saved.sign_in")}</Text><Button title={t("auth.login")} onPress={() => router.push("/login")} /></View>;
  const shown = items.filter(x => !kind || x.kind === kind);
  return <ScrollView contentContainerStyle={ui.screen} refreshControl={pull}>
    <Link href="/" style={ui.link}>← Huambo Online</Link>
    <Text style={ui.h1}>{t("nav.saved")}</Text>
    <Chips options={[{ value: "" as const, label: t("ls.all_m") }, ...(Object.keys(SAVED_KIND_LABELS) as SavedKind[]).map(k => ({ value: k, label: tc(SAVED_KIND_LABELS[k]) }))]} value={kind} onChange={setKind} />
    <Message error={error} />
    {shown.length === 0 && <Text style={ui.text}>{t("ls.saved.empty")}</Text>}
    {shown.map(x => <View key={x.id} style={ui.card}>
      {!!x.image && <LiteImage source={{ uri: x.image }} style={{ width: "100%", height: 160, borderRadius: 10 }} />}
      <Text style={ui.muted}>{tc(SAVED_KIND_LABELS[x.kind as SavedKind] ?? "")}</Text>
      <Text style={ui.h2}>{x.title}</Text>
      {!!x.subtitle && <Text style={ui.text}>{x.subtitle}</Text>}
      <Button title={t("ls.open")} variant="secondary" onPress={() => router.push(itemHref(x.kind, x.target_id) as any)} />
      <Button title={t("ls.remove")} variant="secondary" onPress={() => void remove(x)} />
    </View>)}
  </ScrollView>;
}
