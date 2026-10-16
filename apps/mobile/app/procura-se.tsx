import { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { listWanted, listingPriceLabel, friendlyErrorIn, LISTING_TYPE_LABELS } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui, C } from "../lib/ui";
import { Button, Message } from "../components/Ui";
import { useT, coreText, timeAgoIn } from "../lib/i18n";

/** Pedidos de compradores: "Preciso de…", "Pago…", "Procuro…". */
export default function ProcuraSe() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const params = useLocalSearchParams<{ q?: string }>();
  const [q, setQ] = useState(params.q ?? ""); const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");
  async function search(query = q) {
    setError("");
    const r = await listWanted(supabase(), query);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems((r.data as any[]) ?? []);
  }
  useFocusEffect(useCallback(() => { void search(); }, []));
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <View style={{ backgroundColor: C.yellowSoft, borderRadius: 20, padding: 18, gap: 8 }}>
      <Text style={ui.h1}>{t("ls.wanted.title")}</Text>
      <Text style={ui.text}>{t("ls.wanted.intro")}</Text>
      <Button title={t("ls.wanted.post")} onPress={() => router.push("/classificados/publicar?finalidade=wanted" as any)} />
    </View>
    <TextInput style={ui.input} value={q} onChangeText={setQ} placeholder={t("ls.wanted.ph")} returnKeyType="search" onSubmitEditing={() => void search()} accessibilityLabel={t("ls.wanted.search")} />
    <Message error={error} />
    {items?.length === 0 && <Text style={ui.text}>{q ? t("ls.wanted.none_q", { q }) : t("ls.wanted.none")}</Text>}
    {items?.map(x => <Pressable key={x.id} accessibilityRole="link" onPress={() => router.push(("/classificados/" + x.id) as any)} style={[ui.card, { borderLeftWidth: 6, borderLeftColor: C.yellow }]}>
      <Text style={ui.muted}>{t("home.wanted_badge")} · {tc(LISTING_TYPE_LABELS[x.listing_type as keyof typeof LISTING_TYPE_LABELS] ?? x.listing_type)}</Text>
      <Text style={ui.h2}>{x.title}</Text>
      <Text style={ui.text}>{t("home.budget")} <Text style={{ fontWeight: "800" }}>{tc(coreText(listingPriceLabel(x), t) ?? "")}</Text></Text>
      {!!x.description && <Text style={ui.muted} numberOfLines={2}>{x.description}</Text>}
      <Text style={ui.muted}>{timeAgoIn(x.published_at ?? x.created_at, t, lang)} · {t("ls.wanted.reply")}</Text>
    </Pressable>)}
  </ScrollView>;
}
