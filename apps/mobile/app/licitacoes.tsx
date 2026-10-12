import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { Image, ScrollView, Text, View } from "react-native";
import { listMyAuctionBids, groupMyBids, formatPrice, formatRef, timeLeft, friendlyError, BID_STANDING_LABELS, type MyAuctionBid } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Message } from "../components/Ui";

function Row({ b }: { b: MyAuctionBid }) {
  const router = useRouter();
  const live = b.status === "live" && Date.parse(b.ends_at) > Date.now();
  const open = () => b.listing_id && router.push(("/classificados/" + b.listing_id) as any);
  return <View style={[ui.card, { flexDirection: "row", gap: 12 }]}>
    {b.photo ? <Image source={{ uri: b.photo }} style={{ width: 72, height: 72, borderRadius: 10 }} accessibilityIgnoresInvertColors /> : <Text style={{ fontSize: 40 }}>🔨</Text>}
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={ui.h2} onPress={open} accessibilityRole="link">{b.title}</Text>
      <Text style={b.standing === "winning" || b.standing === "won" ? ui.ok : b.standing === "outbid" ? ui.error : ui.label}>{BID_STANDING_LABELS[b.standing]}</Text>
      <Text style={ui.text}>Preço atual: {formatPrice(b.current_price)}{b.my_max != null && live ? " · O seu máximo: " + formatPrice(b.my_max) : ""}</Text>
      <Text style={ui.muted}>{b.bid_count} lance(s) · {live ? "termina em " + timeLeft(b.ends_at) : "terminou"}{b.ref_no ? " · " + formatRef("listing", b.ref_no) : ""}</Text>
      {live && b.standing === "outbid" && <Button title="Subir o meu máximo" onPress={open} />}
      {b.standing === "won" && <Button title="Contactar o vendedor" variant="secondary" onPress={open} />}
    </View>
  </View>;
}

export default function Licitacoes() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<MyAuctionBid[]>([]); const [error, setError] = useState("");
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void listMyAuctionBids(supabase()).then(r => { if (r.error) setError(friendlyError(r.error)); setItems(r.data); }); }); }, []));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <View style={ui.screen}><Text style={ui.h1}>As minhas licitações</Text><Button title="Entrar" onPress={() => router.push("/login")} /></View>;
  const g = groupMyBids(items);
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/conta" style={ui.link}>← A sua conta</Link>
    <Text style={ui.h1}>🔨 As minhas licitações</Text>
    <Text style={ui.text}>O seu máximo é secreto: o sistema licita por si até lá.</Text>
    <Message error={error || (g.needAttention > 0 ? `⚠️ Foi ultrapassado em ${g.needAttention} leilão(ões) a decorrer.` : "")} />
    <Text style={ui.h2}>A decorrer ({g.live.length})</Text>
    {g.live.length === 0 && <Text style={ui.text}>Não tem licitações em leilões a decorrer.</Text>}
    {g.live.map(b => <Row key={b.auction_id} b={b} />)}
    <Text style={ui.h2}>Terminados ({g.ended.length})</Text>
    {g.ended.length === 0 && <Text style={ui.text}>Ainda nada.</Text>}
    {g.ended.map(b => <Row key={b.auction_id} b={b} />)}
  </ScrollView>;
}
