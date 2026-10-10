import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Text, TextInput, View } from "react-native";
import { requestRental, getListingAuction, startListingAuction, bidOnAuction, cancelAuction, nextMinimumBid, timeLeft,
  formatPrice, parsePrice, friendlyError, type ListingAuction } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";

/** Pedido de aluguer (anúncios para arrendar/alugar). Datas no formato AAAA-MM-DD. */
export function RentalRequestForm({ listingId, uid, defaultPrice }: { listingId: string; uid: string | null; defaultPrice?: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(""); const [end, setEnd] = useState(""); const [price, setPrice] = useState(defaultPrice != null ? String(defaultPrice) : "");
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [ok, setOk] = useState("");
  async function submit() {
    if (!uid) { router.push("/login" as any); return; }
    setBusy(true); setError(""); setOk("");
    const r = await requestRental(supabase(), { listingId, startsAt: start, endsAt: end, price: parsePrice(price) ?? 0, message });
    setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setOk("Pedido enviado. Vai ser notificado quando o dono responder."); setOpen(false); }
  }
  if (!open) return <View style={{ gap: 8 }}><Message ok={ok} /><Button title="📅 Pedir aluguer" onPress={() => setOpen(true)} /></View>;
  return <View style={ui.card}>
    <Text style={ui.h2}>Pedir aluguer</Text>
    <Text style={ui.label}>De (AAAA-MM-DD)</Text>
    <TextInput style={ui.input} value={start} onChangeText={setStart} placeholder="2026-11-01" keyboardType="numbers-and-punctuation" accessibilityLabel="Data de início" />
    <Text style={ui.label}>Até (AAAA-MM-DD)</Text>
    <TextInput style={ui.input} value={end} onChangeText={setEnd} placeholder="2026-11-30" keyboardType="numbers-and-punctuation" accessibilityLabel="Data de fim" />
    <Text style={ui.label}>Valor proposto (Kz)</Text>
    <TextInput style={ui.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
    <Text style={ui.label}>Mensagem (opcional)</Text>
    <TextInput style={[ui.input, ui.area]} multiline value={message} onChangeText={setMessage} />
    <Message error={error} />
    <Button title={busy ? "A enviar…" : "Enviar pedido"} disabled={busy} onPress={() => void submit()} />
    <Button title="Cancelar" variant="secondary" onPress={() => setOpen(false)} />
  </View>;
}

/** Leilão do anúncio: ver, licitar, ou (dono) iniciar/cancelar. */
export function AuctionPanel({ listingId, uid, mine, canStart }: { listingId: string; uid: string | null; mine: boolean; canStart: boolean }) {
  const router = useRouter();
  const [a, setA] = useState<ListingAuction | null>(null); const [loaded, setLoaded] = useState(false);
  const [amount, setAmount] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [ok, setOk] = useState("");
  const [form, setForm] = useState({ open: false, starting: "", reserve: "", increment: "", days: "7" });
  async function load() { const r = await getListingAuction(supabase(), listingId); setA((r.data as ListingAuction) ?? null); setLoaded(true); }
  useEffect(() => { void load(); }, [listingId]);
  async function run(fn: () => PromiseLike<{ error: any }>, msg: string) {
    setBusy(true); setError(""); setOk("");
    const r = await fn(); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setOk(msg); setAmount(""); setForm(f => ({ ...f, open: false })); await load(); }
  }
  if (!loaded) return null;
  const live = !!a && a.status === "live" && new Date(a.ends_at).getTime() > Date.now();

  if (!a || a.status === "cancelled") {
    if (!mine || !canStart) return null;
    if (!form.open) return <View style={{ gap: 8 }}><Message ok={ok} /><Button title="🔨 Pôr em leilão" variant="secondary" onPress={() => setForm({ ...form, open: true })} /></View>;
    return <View style={ui.card}>
      <Text style={ui.h2}>Pôr em leilão</Text>
      <Text style={ui.label}>Preço inicial (Kz)</Text>
      <TextInput style={ui.input} keyboardType="decimal-pad" value={form.starting} onChangeText={v => setForm({ ...form, starting: v })} />
      <Text style={ui.label}>Preço mínimo de venda (opcional, Kz)</Text>
      <TextInput style={ui.input} keyboardType="decimal-pad" value={form.reserve} onChangeText={v => setForm({ ...form, reserve: v })} />
      <Text style={ui.label}>Aumento mínimo por lance (Kz)</Text>
      <TextInput style={ui.input} keyboardType="decimal-pad" value={form.increment} onChangeText={v => setForm({ ...form, increment: v })} placeholder="Ex.: 1000" />
      <Text style={ui.label}>Duração</Text>
      <Chips options={["1", "3", "5", "7", "10", "14"].map(d => ({ value: d, label: d + " dia(s)" }))} value={form.days} onChange={v => setForm({ ...form, days: v })} />
      <Message error={error} />
      <Button title="Iniciar leilão" disabled={busy} onPress={() => void run(() => startListingAuction(supabase(), listingId, {
        startingPrice: parsePrice(form.starting) ?? NaN, reservePrice: parsePrice(form.reserve), minIncrement: parsePrice(form.increment), days: Number(form.days) }), "Leilão iniciado.")} />
      <Button title="Cancelar" variant="secondary" onPress={() => setForm({ ...form, open: false })} />
    </View>;
  }

  return <View style={ui.card} accessibilityLabel="Leilão">
    <Text style={ui.h2}>🔨 Leilão {live ? "a decorrer" : a.status === "scheduled" ? "agendado" : "terminado"}</Text>
    <Text style={ui.price}>{formatPrice(a.current_price)}</Text>
    <Text style={ui.text}>{a.bid_count} lance(s) · {live ? "termina em " + timeLeft(a.ends_at) : "terminou a " + new Date(a.ends_at).toLocaleString("pt-AO")}{!a.reserve_met && a.bid_count > 0 ? " · preço mínimo ainda não atingido" : ""}</Text>
    {a.status === "ended" && <Text style={ui.label}>{a.winner_id ? (a.winner_id === uid ? "🎉 Ganhou este leilão. Contacte o vendedor." : "Leilão vendido.") : "Terminou sem vencedor."}</Text>}
    {live && !mine && <>
      {a.leader_is_me && <Text style={ui.ok}>Está a ganhar este leilão.</Text>}
      <TextInput style={ui.input} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder={"Mínimo " + formatPrice(nextMinimumBid(a))} accessibilityLabel="Valor do lance" />
      <Button title="Licitar" disabled={busy} onPress={() => { if (!uid) { router.push("/login" as any); return; } void run(() => bidOnAuction(supabase(), a.id, parsePrice(amount) ?? NaN), "Lance registado."); }} />
    </>}
    {mine && live && a.bid_count === 0 && <Button title="Cancelar leilão" variant="secondary" disabled={busy} onPress={() => Alert.alert("Cancelar o leilão?", "", [{ text: "Não" }, { text: "Sim", onPress: () => void run(() => cancelAuction(supabase(), a.id), "Leilão cancelado.") }])} />}
    <Message error={error} ok={ok} />
  </View>;
}
