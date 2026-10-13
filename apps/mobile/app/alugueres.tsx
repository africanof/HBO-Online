import { useEffect, useState } from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { Alert, ScrollView, Text, View } from "react-native";
import { listMyRentalRequests, respondRentalRequest, cancelRentalRequest, getPlatformSettings, commissionFor, formatPrice, friendlyError, RENTAL_STATUS_LABELS, type RentalStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";

const d = (s: string) => new Date(s).toLocaleDateString("pt-AO");

export default function Alugueres() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [pct, setPct] = useState(5);
  useEffect(() => { void getPlatformSettings(supabase()).then(r => { if (r.data?.listing_commission_pct != null) setPct(Number(r.data.listing_commission_pct)); }); }, []);
  const params = useLocalSearchParams<{ recebidos?: string }>();
  const [role, setRole] = useState<"renter" | "owner">(params.recebidos ? "owner" : "renter");
  const [items, setItems] = useState<any[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load(r = role) { const res = await listMyRentalRequests(supabase(), r); if (res.error) setError(friendlyError(res.error)); else setItems((res.data as any[]) ?? []); }
  useEffect(() => { void supabase().auth.getUser().then(({ data }) => { const id = data.user?.id ?? null; setUid(id); if (id) void load(params.recebidos ? "owner" : "renter"); }); }, []);
  async function act(fn: () => PromiseLike<{ error: any }>, msg: string) { setError(""); setNotice(""); const r = await fn(); if (r.error) setError(friendlyError(r.error)); else { setNotice(msg); await load(); } }
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <View style={ui.screen}><Link href="/" style={ui.link}>← Huambo Online</Link><Text style={ui.h1}>Alugueres</Text><Link href="/login" style={ui.link}>Inicie sessão</Link></View>;
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/conta" style={ui.link}>← Conta</Link>
    <Text style={ui.h1}>Alugueres</Text>
    <Chips options={[{ value: "renter", label: "Pedidos que fiz" }, { value: "owner", label: "Pedidos recebidos" }]} value={role} onChange={v => { setRole(v as "renter" | "owner"); void load(v as "renter" | "owner"); }} />
    <Message error={error} ok={notice} />
    {items.length === 0 && <Text style={ui.text}>Sem pedidos.</Text>}
    {items.map(r => <View key={r.id} style={ui.card}>
      <Link href={("/classificados/" + r.listing_id) as any} style={ui.link}>{r.listing_title}</Link>
      <Text style={ui.text}>{d(r.starts_at)} → {d(r.ends_at)} · {formatPrice(r.proposed_price)}</Text>
      <Text style={ui.label}>{RENTAL_STATUS_LABELS[r.status as RentalStatus] ?? r.status}</Text>
      <Text style={ui.muted}>{role === "owner" ? "Pedido de" : "Dono"}: {r.other_name}</Text>
      {!!r.message && <Text style={ui.text}>«{r.message}»</Text>}
      {role === "owner" && r.status === "pending" && <>
        <Text style={ui.muted}>Ao aceitar, paga {pct}% de comissão sobre o valor ({formatPrice(commissionFor(r.proposed_price, pct))}) em «Comissões».</Text>
        <Button title="Aceitar" onPress={() => void act(() => respondRentalRequest(supabase(), r.id, true), "Pedido aceite. A comissão está em «Comissões».")} />
        <Button title="Recusar" variant="danger" onPress={() => void act(() => respondRentalRequest(supabase(), r.id, false), "Pedido recusado.")} />
      </>}
      {role === "renter" && ["pending", "accepted"].includes(r.status) && <Button title="Cancelar" variant="secondary" onPress={() => Alert.alert("Cancelar este pedido?", "", [{ text: "Não" }, { text: "Sim", onPress: () => void act(() => cancelRentalRequest(supabase(), r.id), "Pedido cancelado.") }])} />}
    </View>)}
  </ScrollView>;
}
