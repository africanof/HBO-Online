import { useEffect, useState } from "react";
import { Link } from "expo-router";
import { Text, TextInput, View } from "react-native";
import { makeOffer, respondOffer, listOffersFor, validateOffer, offerLabel, parsePrice, friendlyError, OFFER_STATUS_LABELS, type ListingOffer } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Message } from "./Ui";

/** Caixa «Fazer proposta» (dinheiro, troca, ou os dois). */
export function OfferBox({ listingId, uid, offerMoney, offerTrade, tradeOnly, tradeWants }: { listingId: string; uid: string | null; offerMoney: boolean; offerTrade: boolean; tradeOnly: boolean; tradeWants?: string | null }) {
  const [amount, setAmount] = useState(""); const [trade, setTrade] = useState(""); const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState(false);
  async function send() {
    if (!uid) { setError("Inicie sessão para fazer uma proposta."); return; }
    const value = amount.trim() ? parsePrice(amount) ?? NaN : undefined;
    const v = validateOffer({ amount: value, tradeItem: trade }, { offerMoney, offerTrade, tradeOnly }); if (v) { setError(v); return; }
    setBusy(true); setError("");
    const r = await makeOffer(supabase(), listingId, { amount: value, tradeItem: offerTrade ? trade : undefined, message }); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else setDone(true);
  }
  if (done) return <View style={ui.card}><Text style={ui.ok}>Proposta enviada! O vendedor vai responder.</Text><Link href={"/propostas" as any} style={ui.link}>As minhas propostas →</Link></View>;
  return <View style={ui.card}>
    <Text style={ui.h2}>{tradeOnly ? "🔁 Propor troca" : offerTrade ? "💬 Fazer proposta ou troca" : "💬 Fazer proposta"}</Text>
    {!!tradeWants && <Text style={ui.text}>O vendedor aceita em troca: <Text style={ui.label}>{tradeWants}</Text></Text>}
    {offerTrade && <><Text style={ui.label}>{tradeOnly ? "O que oferece em troca?" : "O que oferece em troca? (opcional)"}</Text>
      <TextInput style={ui.input} value={trade} maxLength={300} onChangeText={setTrade} placeholder="Ex.: Samsung A10 em bom estado" /></>}
    {offerMoney && <><Text style={ui.label}>{tradeOnly ? "Dinheiro a mais (Kz, opcional)" : "Quanto oferece (Kz)"}</Text>
      <TextInput style={ui.input} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder="Ex.: 75 000" /></>}
    <TextInput style={[ui.input, ui.area]} multiline value={message} onChangeText={setMessage} placeholder="Mensagem para o vendedor (opcional)" />
    <Message error={error} />
    <Button title={busy ? "A enviar…" : "Enviar proposta"} disabled={busy} onPress={() => void send()} />
  </View>;
}

/** Propostas recebidas (só o dono do anúncio vê). */
export function OffersList({ listingId }: { listingId: string }) {
  const [items, setItems] = useState<ListingOffer[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  async function load() { const r = await listOffersFor(supabase(), listingId); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useEffect(() => { void load(); }, [listingId]);
  async function answer(o: ListingOffer, accept: boolean) {
    setError(""); setNotice("");
    const r = await respondOffer(supabase(), o.id, accept, notes[o.id]);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(accept ? "Proposta aceite. O comprador foi avisado." : "Proposta recusada."); await load(); }
  }
  return <View style={ui.card}>
    <Text style={ui.h2}>💬 Propostas recebidas ({items.filter(o => o.status === "pending").length} à espera)</Text>
    <Message error={error} ok={notice} />
    {items.length === 0 && <Text style={ui.text}>Ainda não recebeu propostas.</Text>}
    {items.map(o => <View key={o.id} style={[ui.card, { backgroundColor: C.surface }]}>
      <Text style={ui.h2}>{offerLabel(o)}</Text>
      <Link href={("/vendedor/" + o.buyer_id) as any} style={ui.link}>{o.buyer_name} →</Link>
      <Text style={ui.muted}>{new Date(o.created_at).toLocaleString("pt-AO")} · {OFFER_STATUS_LABELS[o.status]}</Text>
      {!!o.message && <Text style={ui.text}>💬 {o.message}</Text>}
      {!!o.seller_note && <Text style={ui.text}>A sua resposta: {o.seller_note}</Text>}
      {o.status === "pending" && <>
        <TextInput style={ui.input} value={notes[o.id] ?? ""} onChangeText={t => setNotes(n => ({ ...n, [o.id]: t }))} placeholder="Mensagem para o comprador (opcional)" />
        <Button title="✔ Aceitar" onPress={() => void answer(o, true)} />
        <Button title="✖ Recusar" variant="danger" onPress={() => void answer(o, false)} />
      </>}
    </View>)}
  </View>;
}
