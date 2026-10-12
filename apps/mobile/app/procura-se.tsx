import { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { listWanted, listingPriceLabel, friendlyError, timeAgo, LISTING_TYPE_LABELS } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui, C } from "../lib/ui";
import { Button, Message } from "../components/Ui";

/** Pedidos de compradores: "Preciso de…", "Pago…", "Procuro…". */
export default function ProcuraSe() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const [q, setQ] = useState(params.q ?? ""); const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");
  async function search(query = q) {
    setError("");
    const r = await listWanted(supabase(), query);
    if (r.error) setError(friendlyError(r.error)); else setItems((r.data as any[]) ?? []);
  }
  useFocusEffect(useCallback(() => { void search(); }, []));
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <View style={{ backgroundColor: C.yellowSoft, borderRadius: 20, padding: 18, gap: 8 }}>
      <Text style={ui.h1}>🔎 Procura-se</Text>
      <Text style={ui.text}>Pedidos de compradores e de quem precisa de um serviço (eletricista, canalizador, doméstica, decoradora…). Tem o que procuram? Responda.</Text>
      <Button title="+ Publicar o que procuro" onPress={() => router.push("/classificados/publicar?finalidade=wanted" as any)} />
    </View>
    <TextInput style={ui.input} value={q} onChangeText={setQ} placeholder="Ex.: casa, telefone, router…" returnKeyType="search" onSubmitEditing={() => void search()} accessibilityLabel="Procurar pedidos" />
    <Message error={error} />
    {items?.length === 0 && <Text style={ui.text}>Ainda não há pedidos{q ? ` com «${q}»` : ""}. Seja o primeiro a publicar o que procura.</Text>}
    {items?.map(x => <Pressable key={x.id} accessibilityRole="link" onPress={() => router.push(("/classificados/" + x.id) as any)} style={[ui.card, { borderLeftWidth: 6, borderLeftColor: C.yellow }]}>
      <Text style={ui.muted}>🔎 PROCURA-SE · {LISTING_TYPE_LABELS[x.listing_type as keyof typeof LISTING_TYPE_LABELS] ?? x.listing_type}</Text>
      <Text style={ui.h2}>{x.title}</Text>
      <Text style={ui.text}>Orçamento: <Text style={{ fontWeight: "800" }}>{listingPriceLabel(x)}</Text></Text>
      {!!x.description && <Text style={ui.muted} numberOfLines={2}>{x.description}</Text>}
      <Text style={ui.muted}>{timeAgo(x.published_at ?? x.created_at)} · Tem isto? Toque para responder</Text>
    </Pressable>)}
  </ScrollView>;
}
