import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { Image, ScrollView, Text, View } from "react-native";
import { listMyAuctionBids, groupMyBids, formatPrice, formatRef, timeLeft, friendlyErrorIn, BID_STANDING_LABELS, type MyAuctionBid } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Message } from "../components/Ui";
import { LiteImage } from "../components/LiteImage";
import { useT } from "../lib/i18n";

function Row({ b }: { b: MyAuctionBid }) {
  const router = useRouter(); const { t, tc } = useT();
  const live = b.status === "live" && Date.parse(b.ends_at) > Date.now();
  const open = () => b.listing_id && router.push(("/classificados/" + b.listing_id) as any);
  return <View style={[ui.card, { flexDirection: "row", gap: 12 }]}>
    {b.photo ? <LiteImage source={{ uri: b.photo }} style={{ width: 72, height: 72, borderRadius: 10 }} accessibilityIgnoresInvertColors /> : <Text style={{ fontSize: 40 }}>🔨</Text>}
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={ui.h2} onPress={open} accessibilityRole="link">{b.title}</Text>
      <Text style={b.standing === "winning" || b.standing === "won" ? ui.ok : b.standing === "outbid" ? ui.error : ui.label}>{tc(BID_STANDING_LABELS[b.standing])}</Text>
      <Text style={ui.text}>{t("ls.bids.current", { price: formatPrice(b.current_price) })}{b.my_max != null && live ? " · " + t("ls.bids.my_max", { price: formatPrice(b.my_max) }) : ""}</Text>
      <Text style={ui.muted}>{t("ls.bids.count", { n: b.bid_count })} · {live ? t("ls.bids.ends_in", { time: tc(timeLeft(b.ends_at)) }) : t("ls.bids.ended")}{b.ref_no ? " · " + formatRef("listing", b.ref_no) : ""}</Text>
      {live && b.standing === "outbid" && <Button title={t("ls.bids.raise")} onPress={open} />}
      {b.standing === "won" && <Button title={t("ls.contact_seller")} variant="secondary" onPress={open} />}
    </View>
  </View>;
}

export default function Licitacoes() {
  const router = useRouter(); const { t, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<MyAuctionBid[]>([]); const [error, setError] = useState("");
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void listMyAuctionBids(supabase()).then(r => { if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }); }); }, []));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></View>;
  if (!uid) return <View style={ui.screen}><Text style={ui.h1}>{t("ls.bids.title")}</Text><Button title={t("auth.login")} onPress={() => router.push("/login")} /></View>;
  const g = groupMyBids(items);
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/conta" style={ui.link}>← {t("account.title")}</Link>
    <Text style={ui.h1}>🔨 {t("ls.bids.title")}</Text>
    <Text style={ui.text}>{t("ls.bids.secret")}</Text>
    <Message error={error || (g.needAttention > 0 ? t("ls.bids.outbid", { n: g.needAttention }) : "")} />
    <Text style={ui.h2}>{t("ls.bids.live", { n: g.live.length })}</Text>
    {g.live.length === 0 && <Text style={ui.text}>{t("ls.bids.none_live")}</Text>}
    {g.live.map(b => <Row key={b.auction_id} b={b} />)}
    <Text style={ui.h2}>{t("ls.bids.ended_n", { n: g.ended.length })}</Text>
    {g.ended.length === 0 && <Text style={ui.text}>{t("ls.nothing_yet")}</Text>}
    {g.ended.map(b => <Row key={b.auction_id} b={b} />)}
  </ScrollView>;
}
