import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { Alert, ScrollView, Text, View } from "react-native";
import { listMyOffers, withdrawOffer, offerLabel, friendlyError, OFFER_STATUS_LABELS, type MyOffer } from "@huambo-online/core";
import { currentUserId, supabase } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Message } from "../components/Ui";

export default function Propostas() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<MyOffer[] | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listMyOffers(supabase()); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []));
  function withdraw(id: string) {
    Alert.alert("Retirar proposta", "Tem a certeza?", [{ text: "Não", style: "cancel" }, { text: "Retirar", style: "destructive", onPress: async () => {
      const r = await withdrawOffer(supabase(), id);
      if (r.error) setError(friendlyError(r.error)); else { setNotice("Proposta retirada."); await load(); }
    } }]);
  }
  if (uid === undefined) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.text}>A carregar…</Text></ScrollView>;
  if (!uid) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>As minhas propostas</Text><Button title="Entrar" onPress={() => router.push("/login")} /></ScrollView>;
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/conta" style={ui.link}>← A sua conta</Link>
    <Text style={ui.h1}>💬 As minhas propostas</Text>
    <Text style={ui.text}>Propostas de compra e de troca que fez a vendedores. Quando o vendedor responde, recebe uma notificação.</Text>
    <Message error={error} ok={notice} />
    {items === null && !error && <Text style={ui.text}>A carregar…</Text>}
    {items?.length === 0 && <Text style={ui.text}>Ainda não fez propostas.</Text>}
    {items?.map(o => <View key={o.id} style={ui.card}>
      <Link href={("/classificados/" + o.listing_id) as any} style={ui.link}>{o.listing_title} →</Link>
      <Text style={ui.h2}>{offerLabel(o)}</Text>
      <Text style={ui.label}>{OFFER_STATUS_LABELS[o.status]}</Text>
      {!!o.seller_note && <Text style={ui.text}>Resposta do vendedor: {o.seller_note}</Text>}
      <Text style={ui.muted}>{new Date(o.created_at).toLocaleString("pt-AO")}</Text>
      {o.status === "pending" && <Button title="Retirar proposta" variant="secondary" onPress={() => withdraw(o.id)} />}
    </View>)}
  </ScrollView>;
}
