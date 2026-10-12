import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { listMarkets, suggestMarket, marketSummary, friendlyError, type Market } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { ui, C } from "../../lib/ui";
import { Button, Chips, Message } from "../../components/Ui";
import { useTerritory } from "../../components/Directory";
import { SearchBar } from "../../components/Brand";

export default function Pracas() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const [q, setQ] = useState(params.q ?? "");
  const { municipalities } = useTerritory();
  const [items, setItems] = useState<Market[] | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ open: false, name: "", municipalityId: "", addressText: "", description: "" }); const [busy, setBusy] = useState(false);
  useEffect(() => { void search(); }, []);
  async function search(query = q) {
    setError("");
    const r = await listMarkets(supabase(), { query });
    if (r.error) setError(friendlyError(r.error)); else setItems((r.data as Market[]) ?? []);
  }
  async function suggest() {
    setError(""); setNotice("");
    if (!(await currentUserId())) { router.push("/login"); return; }
    setBusy(true);
    const r = await suggestMarket(supabase(), form); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setNotice("Obrigado! A praça vai aparecer depois de a administração aprovar."); setForm({ open: false, name: "", municipalityId: "", addressText: "", description: "" }); }
  }
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <SearchBar scope="pracas" initial={q} onSearch={v => { setQ(v); void search(v); }} />
    <View style={{ backgroundColor: C.yellowSoft, borderRadius: 20, padding: 18, gap: 6 }}>
      <Text style={ui.h1}>🧺 Praças do Huambo</Text>
      <Text style={ui.text}>O que se vende nas praças — Kapango, Ferro, Cassilhas, Alemanha e outras — e os vendedores de cada uma.</Text>
    </View>
    <Message error={error} ok={notice} />
    {items?.length === 0 && <Text style={ui.text}>Nenhuma praça encontrada.</Text>}
    {items?.map(m => <Pressable key={m.id} style={ui.card} accessibilityRole="link" onPress={() => router.push(("/pracas/" + m.id) as any)}>
      <View style={{ height: 120, borderRadius: 12, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {m.photo_url ? <Image source={{ uri: m.photo_url }} style={{ width: "100%", height: "100%" }} /> : <Text style={{ fontSize: 48 }}>🧺</Text>}
      </View>
      <Text style={ui.h2}>{m.name}</Text>
      <Text style={ui.muted}>📍 {[m.address_text, m.municipality_name].filter(Boolean).join(", ") || "Huambo"}</Text>
      {!!m.opening_hours && <Text style={ui.muted}>🕘 {m.opening_hours}</Text>}
      <Text style={ui.label}>{marketSummary(m)}</Text>
    </Pressable>)}
    <View style={ui.card}>
      <Text style={ui.h2}>Falta alguma praça?</Text>
      {!form.open ? <Button title="+ Sugerir uma praça" variant="secondary" onPress={() => setForm({ ...form, open: true })} /> : <>
        <Text style={ui.label}>Nome da praça</Text>
        <TextInput style={ui.input} value={form.name} onChangeText={v => setForm({ ...form, name: v })} placeholder="Ex.: Praça do São Pedro" />
        <Text style={ui.label}>Município</Text>
        <Chips options={municipalities.map(m => ({ value: m.id, label: m.name }))} value={form.municipalityId} onChange={v => setForm({ ...form, municipalityId: v })} />
        <Text style={ui.label}>Bairro ou referência (opcional)</Text>
        <TextInput style={ui.input} value={form.addressText} onChangeText={v => setForm({ ...form, addressText: v })} />
        <Text style={ui.label}>O que se vende lá? (opcional)</Text>
        <TextInput style={[ui.input, ui.area]} multiline value={form.description} onChangeText={v => setForm({ ...form, description: v })} />
        <Button title={busy ? "A enviar…" : "Enviar sugestão"} disabled={busy} onPress={() => void suggest()} />
        <Button title="Cancelar" variant="secondary" onPress={() => setForm({ ...form, open: false })} />
      </>}
    </View>
  </ScrollView>;
}
