import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { Image, Pressable, ScrollView, Text } from "react-native";
import { loadHistory, clearHistory, itemHref, SAVED_KIND_LABELS, type HistoryEntry } from "@huambo-online/core";
import { deviceStore } from "../components/Engage";
import { ui } from "../lib/ui";
import { Button } from "../components/Ui";
import { LiteImage } from "../components/LiteImage";
import { useT, formatDateTimeIn } from "../lib/i18n";

export default function Historico() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const [items, setItems] = useState<HistoryEntry[] | null>(null);
  useFocusEffect(useCallback(() => { void loadHistory(deviceStore).then(setItems); }, []));
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/" style={ui.link}>← Huambo Online</Link>
    <Text style={ui.h1}>{t("more.recent")}</Text>
    <Text style={ui.muted}>{t("ls.history.local")}</Text>
    {!!items?.length && <Button title={t("ls.history.clear")} variant="secondary" onPress={async () => { await clearHistory(deviceStore); setItems([]); }} />}
    {items?.length === 0 && <Text style={ui.text}>{t("ls.history.empty")}</Text>}
    {items?.map(x => <Pressable key={x.kind + x.id} style={ui.card} accessibilityRole="link" onPress={() => router.push(itemHref(x.kind, x.id) as any)}>
      {!!x.image && <LiteImage source={{ uri: x.image }} style={{ width: "100%", height: 140, borderRadius: 10 }} />}
      <Text style={ui.muted}>{tc(SAVED_KIND_LABELS[x.kind])} · {formatDateTimeIn(new Date(x.at).toISOString(), lang)}</Text>
      <Text style={ui.h2}>{x.title}</Text>
    </Pressable>)}
  </ScrollView>;
}
