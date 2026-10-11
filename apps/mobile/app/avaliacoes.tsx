import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { ScrollView, Text } from "react-native";
import { listPendingReviews, friendlyError, type PendingReview } from "@huambo-online/core";
import { currentUserId, supabase } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Message } from "../components/Ui";
import { DealReviewForm } from "../components/Reputation";

export default function Avaliacoes() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<PendingReview[] | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listPendingReviews(supabase()); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []));
  if (uid === undefined) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.text}>A carregar…</Text></ScrollView>;
  if (!uid) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>Avaliações</Text><Text style={ui.text}>Inicie sessão para avaliar os seus negócios.</Text><Button title="Entrar" onPress={() => router.push("/login")} /></ScrollView>;
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>← A sua conta</Link>
    <Text style={ui.h1}>⭐ Avaliações por fazer</Text>
    <Text style={ui.text}>Depois de um negócio concluído, o vendedor e o comprador avaliam-se um ao outro. Só quem fez o negócio pode avaliar.</Text>
    <Message error={error} ok={notice} />
    {items === null && !error && <Text style={ui.text}>A carregar…</Text>}
    {items?.length === 0 && <Text style={ui.text}>Não tem avaliações por fazer. 👍</Text>}
    {items?.map(it => <DealReviewForm key={it.kind + it.ref_id} item={it} onDone={() => { setNotice("Obrigado! A sua avaliação foi publicada."); void load(); }} />)}
    <Link href={("/vendedor/" + uid) as any} style={ui.link}>Ver as avaliações que recebi →</Link>
  </ScrollView>;
}
