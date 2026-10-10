import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { Image, ScrollView, Text, View } from "react-native";
import { listMySaved, toggleSaved, itemHref, friendlyError, SAVED_KIND_LABELS, type SavedKind } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";

export default function Guardados() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<any[]>([]); const [kind, setKind] = useState<SavedKind | "">(""); const [error, setError] = useState("");
  async function load() { const r = await listMySaved(supabase()); if (r.error) setError(friendlyError(r.error)); else setItems((r.data as any[]) ?? []); }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []));
  async function remove(x: any) { if (!uid) return; const r = await toggleSaved(supabase(), uid, x.kind, x.target_id, x.id); if (r.error) setError(friendlyError(r.error)); else setItems(a => a.filter(i => i.id !== x.id)); }
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <View style={ui.screen}><Text style={ui.h1}>Guardados</Text><Text style={ui.text}>Inicie sessão para ver os seus favoritos.</Text><Button title="Entrar" onPress={() => router.push("/login")} /></View>;
  const shown = items.filter(x => !kind || x.kind === kind);
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/" style={ui.link}>← Huambo Online</Link>
    <Text style={ui.h1}>Guardados</Text>
    <Chips options={[{ value: "" as const, label: "Todos" }, ...(Object.keys(SAVED_KIND_LABELS) as SavedKind[]).map(k => ({ value: k, label: SAVED_KIND_LABELS[k] }))]} value={kind} onChange={setKind} />
    <Message error={error} />
    {shown.length === 0 && <Text style={ui.text}>Ainda não guardou nada aqui. Use «☆ Guardar» nos anúncios, profissionais, empresas e produtos.</Text>}
    {shown.map(x => <View key={x.id} style={ui.card}>
      {!!x.image && <Image source={{ uri: x.image }} style={{ width: "100%", height: 160, borderRadius: 10 }} />}
      <Text style={ui.muted}>{SAVED_KIND_LABELS[x.kind as SavedKind] ?? ""}</Text>
      <Text style={ui.h2}>{x.title}</Text>
      {!!x.subtitle && <Text style={ui.text}>{x.subtitle}</Text>}
      <Button title="Abrir" variant="secondary" onPress={() => router.push(itemHref(x.kind, x.target_id) as any)} />
      <Button title="Remover" variant="secondary" onPress={() => void remove(x)} />
    </View>)}
  </ScrollView>;
}
