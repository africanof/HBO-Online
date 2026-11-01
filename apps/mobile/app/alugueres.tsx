import { useEffect, useState } from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { Alert, ScrollView, Text, View } from "react-native";
import { listMyRentalRequests, respondRentalRequest, cancelRentalRequest, getPlatformSettings, commissionFor, commissionFreeListingIds, formatPrice, friendlyErrorIn, RENTAL_STATUS_LABELS, type RentalStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";
import { useT, formatDayIn } from "../lib/i18n";

export default function Alugueres() {
  const { t, tc, lang } = useT();
  const d = (s: string) => formatDayIn(Date.parse(s), lang);
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [pct, setPct] = useState(5);
  useEffect(() => { void getPlatformSettings(supabase()).then(r => { if (r.data?.listing_commission_pct != null) setPct(Number(r.data.listing_commission_pct)); }); }, []);
  const params = useLocalSearchParams<{ recebidos?: string }>();
  const [role, setRole] = useState<"renter" | "owner">(params.recebidos ? "owner" : "renter");
  const [items, setItems] = useState<any[]>([]); const [free, setFree] = useState<Set<string>>(new Set()); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load(r = role) { const res = await listMyRentalRequests(supabase(), r); if (res.error) setError(friendlyErrorIn(res.error, lang)); else { const rows = (res.data as any[]) ?? []; setItems(rows); setFree(await commissionFreeListingIds(supabase(), rows.map(x => x.listing_id))); } }
  useEffect(() => { void supabase().auth.getUser().then(({ data }) => { const id = data.user?.id ?? null; setUid(id); if (id) void load(params.recebidos ? "owner" : "renter"); }); }, []);
  async function act(fn: () => PromiseLike<{ error: any }>, msg: string) { setError(""); setNotice(""); const r = await fn(); if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(msg); await load(); } }
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></View>;
  if (!uid) return <View style={ui.screen}><Link href="/" style={ui.link}>← Huambo Online</Link><Text style={ui.h1}>{t("ls.rent.title")}</Text><Link href="/login" style={ui.link}>{t("ls.rent.sign_in")}</Link></View>;
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/conta" style={ui.link}>← {t("nav.account_short")}</Link>
    <Text style={ui.h1}>{t("ls.rent.title")}</Text>
    <Chips options={[{ value: "renter", label: t("ls.rent.made") }, { value: "owner", label: t("ls.rent.received") }]} value={role} onChange={v => { setRole(v as "renter" | "owner"); void load(v as "renter" | "owner"); }} />
    <Message error={error} ok={notice} />
    {items.length === 0 && <Text style={ui.text}>{t("ls.rent.none")}</Text>}
    {items.map(r => <View key={r.id} style={ui.card}>
      <Link href={("/classificados/" + r.listing_id) as any} style={ui.link}>{r.listing_title}</Link>
      <Text style={ui.text}>{d(r.starts_at)} → {d(r.ends_at)} · {formatPrice(r.proposed_price)}</Text>
      <Text style={ui.label}>{tc(RENTAL_STATUS_LABELS[r.status as RentalStatus] ?? r.status)}</Text>
      <Text style={ui.muted}>{role === "owner" ? t("ls.rent.from", { name: r.other_name }) : t("ls.rent.owner", { name: r.other_name })}</Text>
      {!!r.message && <Text style={ui.text}>«{r.message}»</Text>}
      {role === "owner" && r.status === "pending" && <>
        <Text style={ui.muted}>{free.has(r.listing_id) ? "🎉 " + t("ls.rent_free_note") : t("ls.rent.commission", { pct, amount: formatPrice(commissionFor(r.proposed_price, pct)) })}</Text>
        <Button title={t("ls.accept")} onPress={() => void act(() => respondRentalRequest(supabase(), r.id, true), t("ls.rent.accepted"))} />
        <Button title={t("ls.decline")} variant="danger" onPress={() => void act(() => respondRentalRequest(supabase(), r.id, false), t("ls.rent.declined"))} />
      </>}
      {role === "renter" && ["pending", "accepted"].includes(r.status) && <Button title={t("common.cancel")} variant="secondary" onPress={() => Alert.alert(t("ls.rent.cancel_q"), "", [{ text: t("ls.no") }, { text: t("ls.yes"), onPress: () => void act(() => cancelRentalRequest(supabase(), r.id), t("ls.rent.cancelled")) }])} />}
    </View>)}
  </ScrollView>;
}
