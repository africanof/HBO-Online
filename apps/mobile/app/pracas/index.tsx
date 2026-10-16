import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { listMarkets, suggestMarket, friendlyErrorIn, type Market } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { ui, C } from "../../lib/ui";
import { Button, Chips, Message } from "../../components/Ui";
import { useTerritory } from "../../components/Directory";
import { SearchBar } from "../../components/Brand";
import { LiteImage } from "../../components/LiteImage";
import { useT, marketSummaryIn } from "../../lib/i18n";

export default function Pracas() {
  const router = useRouter(); const { t, lang } = useT();
  const params = useLocalSearchParams<{ q?: string }>();
  const [q, setQ] = useState(params.q ?? "");
  const { municipalities } = useTerritory();
  const [items, setItems] = useState<Market[] | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ open: false, name: "", municipalityId: "", addressText: "", description: "" }); const [busy, setBusy] = useState(false);
  useEffect(() => { void search(); }, []);
  async function search(query = q) {
    setError("");
    const r = await listMarkets(supabase(), { query });
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems((r.data as Market[]) ?? []);
  }
  async function suggest() {
    setError(""); setNotice("");
    if (!(await currentUserId())) { router.push("/login"); return; }
    setBusy(true);
    const r = await suggestMarket(supabase(), form); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("sv.mk_suggest_ok")); setForm({ open: false, name: "", municipalityId: "", addressText: "", description: "" }); }
  }
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <SearchBar scope="pracas" initial={q} onSearch={v => { setQ(v); void search(v); }} />
    <View style={{ backgroundColor: C.yellowSoft, borderRadius: 20, padding: 18, gap: 6 }}>
      <Text style={ui.h1}>{t("sv.mk_title")}</Text>
      <Text style={ui.text}>{t("sv.mk_intro")}</Text>
    </View>
    <Message error={error} ok={notice} />
    {items?.length === 0 && <Text style={ui.text}>{t("sv.mk_none")}</Text>}
    {items?.map(m => <Pressable key={m.id} style={ui.card} accessibilityRole="link" onPress={() => router.push(("/pracas/" + m.id) as any)}>
      <View style={{ height: 120, borderRadius: 12, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {m.photo_url ? <LiteImage placeholder="🧺" source={{ uri: m.photo_url }} style={{ width: "100%", height: "100%" }} /> : <Text style={{ fontSize: 48 }}>🧺</Text>}
      </View>
      <Text style={ui.h2}>{m.name}</Text>
      <Text style={ui.muted}>📍 {[m.address_text, m.municipality_name].filter(Boolean).join(", ") || "Huambo"}</Text>
      {!!m.opening_hours && <Text style={ui.muted}>🕘 {m.opening_hours}</Text>}
      <Text style={ui.label}>{marketSummaryIn(m as any, t)}</Text>
    </Pressable>)}
    <View style={ui.card}>
      <Text style={ui.h2}>{t("sv.mk_missing")}</Text>
      {!form.open ? <Button title={t("sv.mk_suggest")} variant="secondary" onPress={() => setForm({ ...form, open: true })} /> : <>
        <Text style={ui.label}>{t("sv.mk_name")}</Text>
        <TextInput style={ui.input} value={form.name} onChangeText={v => setForm({ ...form, name: v })} placeholder={t("sv.mk_name_ph")} />
        <Text style={ui.label}>{t("sv.municipality")}</Text>
        <Chips options={municipalities.map(m => ({ value: m.id, label: m.name }))} value={form.municipalityId} onChange={v => setForm({ ...form, municipalityId: v })} />
        <Text style={ui.label}>{t("sv.mk_address")}</Text>
        <TextInput style={ui.input} value={form.addressText} onChangeText={v => setForm({ ...form, addressText: v })} />
        <Text style={ui.label}>{t("sv.mk_what")}</Text>
        <TextInput style={[ui.input, ui.area]} multiline value={form.description} onChangeText={v => setForm({ ...form, description: v })} />
        <Button title={busy ? t("sv.sending") : t("sv.mk_send")} disabled={busy} onPress={() => void suggest()} />
        <Button title={t("common.cancel")} variant="secondary" onPress={() => setForm({ ...form, open: false })} />
      </>}
    </View>
  </ScrollView>;
}
