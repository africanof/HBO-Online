import { useCallback, useState } from "react";
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Image, ScrollView, Text, View } from "react-native";
import { listMyClassifiedListings, deleteClassifiedListing, updateClassifiedStatus, publishClassifiedListing, removeClassifiedMedia,
  formatPrice, friendlyError, STATUS_LABELS } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Message } from "../components/Ui";

export default function MeusAnuncios() {
  const router = useRouter();
  const params = useLocalSearchParams<{ erro?: string }>();
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState(params.erro ? "O anúncio foi guardado como rascunho mas não foi publicado: " + params.erro : "");
  const [busy, setBusy] = useState("");

  async function load() {
    const uid = await currentUserId();
    if (!uid) { setError("Inicie sessão para ver os seus anúncios."); setItems([]); return; }
    const r = await listMyClassifiedListings(supabase(), uid);
    if (r.error) setError(friendlyError(r.error)); setItems(r.data ?? []);
  }
  useFocusEffect(useCallback(() => { void load(); }, []));

  async function act(id: string, fn: () => Promise<{ error: any }>) {
    setBusy(id); setError("");
    const r = await fn(); setBusy("");
    if (r.error) setError(friendlyError(r.error)); else await load();
  }

  function confirmDelete(x: any) {
    Alert.alert("Apagar anúncio", "Tem a certeza? Não pode ser desfeito.", [{ text: "Cancelar", style: "cancel" }, { text: "Apagar", style: "destructive", onPress: () => void act(x.id, async () => { const r = await deleteClassifiedListing(supabase(), x.id); if (!r.error) await removeClassifiedMedia(supabase(), x.media ?? []); return r; }) }]);
  }

  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/" style={ui.link}>← Huambo Online</Link>
    <Text style={ui.h1}>Os meus anúncios</Text>
    <Button title="+ Publicar anúncio" onPress={() => router.push("/classificados/publicar" as any)} />
    <Message error={error} />
    {items === null && <Text style={ui.text}>A carregar…</Text>}
    {items?.length === 0 && !error && <Text style={ui.text}>Ainda não publicou anúncios.</Text>}
    {items?.map(x => <View key={x.id} style={ui.card}>
      {Array.isArray(x.media) && x.media[0] && <Image source={{ uri: x.media[0] }} style={{ width: "100%", height: 160, borderRadius: 10 }} />}
      <Text style={ui.h2}>{x.title}</Text>
      <Text style={ui.text}>{STATUS_LABELS[x.status as keyof typeof STATUS_LABELS] ?? x.status} · {formatPrice(x.price, x.currency)}</Text>
      <View style={{ gap: 8 }}>
        <Button title="Ver" variant="secondary" onPress={() => router.push(("/classificados/" + x.id) as any)} />
        <Button title="Editar" variant="secondary" onPress={() => router.push(`/classificados/${x.id}/editar` as any)} />
        {x.status === "published"
          ? <Button title="Pausar" variant="secondary" disabled={busy === x.id} onPress={() => void act(x.id, () => updateClassifiedStatus(supabase(), x.id, "paused"))} />
          : <Button title="Publicar" disabled={busy === x.id} onPress={() => void act(x.id, () => publishClassifiedListing(supabase(), x.id))} />}
        {x.status === "published" && <Button title={x.purpose === "sale" ? "Marcar vendido" : "Fechar"} variant="secondary" disabled={busy === x.id} onPress={() => void act(x.id, () => updateClassifiedStatus(supabase(), x.id, x.purpose === "sale" ? "sold" : "closed"))} />}
        <Button title="Apagar" variant="danger" disabled={busy === x.id} onPress={() => confirmDelete(x)} />
      </View>
    </View>)}
  </ScrollView>;
}
