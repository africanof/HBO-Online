import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Text, TextInput, View } from "react-native";
import { requestRental, getListingAuction, startListingAuction, bidOnAuction, cancelAuction, nextMinimumBid, timeLeft,
  formatPrice, parsePrice, friendlyError, buyAuctionNow, listBidsForAuction, retractMyBid, cancelBidAsSeller, canRetractBid, RETRACT_REASON_LABELS,
  type ListingAuction, type AuctionBid, type RetractReason } from "@huambo-online/core";
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
  const [form, setForm] = useState({ open: false, starting: "", reserve: "", increment: "", days: "7", buyNow: "" });
  async function load() { const r = await getListingAuction(supabase(), listingId); setA((r.data as ListingAuction) ?? null); setLoaded(true); }
  useEffect(() => { void load(); }, [listingId]);
  async function run(fn: () => PromiseLike<{ error: any }>, msg: string) {
    setBusy(true); setError(""); setOk("");
    const r = await fn(); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setOk(msg); setAmount(""); setForm(f => ({ ...f, open: false })); await load(); }
  }
  async function placeMax() {
    if (!a) return;
    setBusy(true); setError(""); setOk("");
    const r = await bidOnAuction(supabase(), a.id, parsePrice(amount) ?? NaN);
    if (r.error) { setBusy(false); setError(friendlyError(r.error)); return; }
    const fresh = (await getListingAuction(supabase(), listingId)).data as ListingAuction | null;
    setBusy(false); setAmount(""); if (fresh) setA(fresh);
    setOk(fresh?.leader_is_me ? `Está a ganhar com ${formatPrice(fresh.current_price)}. O sistema licita por si até ${formatPrice(fresh.my_best)}.` : "");
    if (fresh && !fresh.leader_is_me) setError(`Foi ultrapassado de imediato: outra pessoa já tinha um máximo maior. Preço atual: ${formatPrice(fresh.current_price)}.`);
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
      <Text style={ui.label}>Preço «Comprar já» (opcional, Kz)</Text>
      <TextInput style={ui.input} keyboardType="decimal-pad" value={form.buyNow} onChangeText={v => setForm({ ...form, buyNow: v })} accessibilityLabel="Preço Comprar já em Kz" placeholder="Quem quiser compra logo, até ao 1.º lance" />
      <Text style={ui.label}>Aumento mínimo por lance (Kz)</Text>
      <TextInput style={ui.input} keyboardType="decimal-pad" value={form.increment} onChangeText={v => setForm({ ...form, increment: v })} placeholder="Ex.: 1000" />
      <Text style={ui.label}>Duração</Text>
      <Chips options={["1", "3", "5", "7", "10", "14"].map(d => ({ value: d, label: d + " dia(s)" }))} value={form.days} onChange={v => setForm({ ...form, days: v })} />
      <Message error={error} />
      <Button title="Iniciar leilão" disabled={busy} onPress={() => void run(() => startListingAuction(supabase(), listingId, {
        startingPrice: parsePrice(form.starting) ?? NaN, reservePrice: parsePrice(form.reserve), minIncrement: parsePrice(form.increment), days: Number(form.days), buyNowPrice: parsePrice(form.buyNow) }), "Leilão iniciado.")} />
      <Button title="Cancelar" variant="secondary" onPress={() => setForm({ ...form, open: false })} />
    </View>;
  }

  return <View style={ui.card} accessibilityLabel="Leilão">
    <Text style={ui.h2}>🔨 Leilão {live ? "a decorrer" : a.status === "scheduled" ? "agendado" : "terminado"}</Text>
    <Text style={ui.price}>{formatPrice(a.current_price)}</Text>
    <Text style={ui.text}>{a.bid_count} lance(s) · {live ? "termina em " + timeLeft(a.ends_at) : "terminou a " + new Date(a.ends_at).toLocaleString("pt-AO")}{!a.reserve_met && a.bid_count > 0 ? " · preço mínimo ainda não atingido" : ""}</Text>
    {a.status === "ended" && <Text style={ui.label}>{a.winner_id ? (a.winner_id === uid ? (a.bought_now ? "🎉 Comprou já este artigo. Contacte o vendedor." : "🎉 Ganhou este leilão. Contacte o vendedor.") : a.bought_now ? "Vendido com «Comprar já»." : "Leilão vendido.") : a.has_reserve && a.bid_count > 0 ? "Terminou sem atingir o preço mínimo de venda." : "Terminou sem vencedor."}</Text>}
    {live && a.buy_now_available && a.buy_now_price != null && (mine
      ? <Text style={ui.text}>🛒 «Comprar já» por {formatPrice(a.buy_now_price)} (desaparece com o primeiro lance)</Text>
      : <View style={{ gap: 6 }}>
          <Text style={ui.text}>🛒 Não quer esperar? Compre já por {formatPrice(a.buy_now_price)}. Desaparece com o primeiro lance.</Text>
          <Button title={"🛒 Comprar já por " + formatPrice(a.buy_now_price)} disabled={busy} onPress={() => { if (!uid) { router.push("/login" as any); return; } Alert.alert("Comprar já", `Comprar por ${formatPrice(a.buy_now_price)}? O leilão termina e o artigo é seu.`, [{ text: "Não" }, { text: "Comprar", onPress: () => void run(() => buyAuctionNow(supabase(), a.id), "Comprou! Contacte o vendedor para combinar a entrega.") }]); }} />
        </View>)}
    {live && !mine && <>
      {a.leader_is_me ? <Text style={ui.ok}>✔ Está a ganhar. O seu máximo secreto: {formatPrice(a.my_best)}. Pode subi-lo.</Text>
        : a.my_best != null ? <Text style={ui.error}>Foi ultrapassado: outra pessoa tem um máximo maior. Suba o seu máximo para voltar a ganhar.</Text> : null}
      <Text style={ui.text}>💡 Como no eBay: escreva o MÁXIMO que está disposto a pagar. O Huambo Online licita por si só o necessário para ficar à frente, até esse valor, que ninguém vê.</Text>
      <Text style={ui.label}>{a.leader_is_me ? "Novo máximo (Kz)" : "O seu máximo (Kz)"}</Text>
      <TextInput style={ui.input} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder={"Mínimo " + formatPrice(nextMinimumBid(a))} accessibilityLabel={a.leader_is_me ? "Novo máximo em Kz" : "O seu máximo em Kz"} />
      <Button title={a.leader_is_me ? "Subir máximo" : "Licitar"} disabled={busy} onPress={() => { if (!uid) { router.push("/login" as any); return; } void placeMax(); }} />
    </>}
    {a.status !== "scheduled" && <BidHistory auction={a} mine={mine} uid={uid} version={a.current_price + ":" + a.bid_count} onChanged={m => { setOk(m); void load(); }} />}
    {mine && live && a.bid_count === 0 && <Button title="Cancelar leilão" variant="secondary" disabled={busy} onPress={() => Alert.alert("Cancelar o leilão?", "", [{ text: "Não" }, { text: "Sim", onPress: () => void run(() => cancelAuction(supabase(), a.id), "Leilão cancelado.") }])} />}
    <Message error={error} ok={ok} />
  </View>;
}

/** Lances do leilão: retirar os meus (com motivo) ou, para o vendedor, cancelar os de uma pessoa. */
function BidHistory({ auction, mine, uid, version, onChanged }: { auction: ListingAuction; mine: boolean; uid: string | null; version: string; onChanged: (msg: string) => void }) {
  const [bids, setBids] = useState<AuctionBid[]>([]); const [open, setOpen] = useState(false); const [error, setError] = useState("");
  const [reason, setReason] = useState<RetractReason | "">(""); const [asking, setAsking] = useState(false); const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState<AuctionBid | null>(null); const [why, setWhy] = useState("");
  async function load() { const r = await listBidsForAuction(supabase(), auction.id); if (!r.error) setBids(r.data); }
  useEffect(() => { void load(); }, [auction.id, version, uid]);
  const live = auction.status === "live" && new Date(auction.ends_at).getTime() > Date.now();
  const myBids = bids.filter(b => b.is_mine);
  const can = canRetractBid(auction, myBids);
  async function retract() {
    if (!reason) { setError("Escolha o motivo."); return; }
    setBusy(true); setError("");
    const r = await retractMyBid(supabase(), auction.id, reason); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setAsking(false); setReason(""); onChanged("Os seus lances foram retirados."); await load(); }
  }
  async function cancel() {
    if (!cancelling) return;
    if (!why.trim()) { setError("Escreva o motivo (a pessoa vai ler)."); return; }
    setBusy(true); setError("");
    const r = await cancelBidAsSeller(supabase(), cancelling.id, why); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setCancelling(null); setWhy(""); onChanged("Lances cancelados. A pessoa não pode voltar a licitar neste leilão."); await load(); }
  }
  if (!bids.length) return null;
  return <View style={{ gap: 8 }}>
    <Button title={open ? "Esconder lances" : `Ver lances (${bids.filter(b => !b.retracted).length})`} variant="secondary" onPress={() => setOpen(!open)} />
    {open && bids.map(b => <View key={b.id} style={{ gap: 4, opacity: b.retracted ? 0.7 : 1 }}>
      <Text style={ui.text}><Text style={ui.label}>{b.bidder_label}</Text>{b.is_auto ? " (automático)" : ""} · <Text style={b.retracted ? { textDecorationLine: "line-through" } : undefined}>{formatPrice(b.amount)}</Text> · {new Date(b.created_at).toLocaleString("pt-AO")}</Text>
      {b.retracted && <Text style={ui.muted}>{b.retracted_by_seller ? "Cancelado pelo vendedor" : "Retirado"}{b.retract_reason ? ": " + b.retract_reason : ""}</Text>}
      {mine && live && !b.retracted && <Button title={"Cancelar lances de " + b.bidder_label} variant="secondary" onPress={() => { setCancelling(b); setWhy(""); setError(""); }} />}
    </View>)}
    {cancelling && <View style={ui.card}>
      <Text style={ui.label}>Cancelar os lances de {cancelling.bidder_label}</Text>
      <TextInput style={[ui.input, ui.area]} multiline value={why} onChangeText={setWhy} accessibilityLabel="Motivo" placeholder="Motivo (a pessoa vai ler)" />
      <Message error={error} />
      <Button title="Cancelar lances" variant="danger" disabled={busy} onPress={() => void cancel()} />
      <Button title="Voltar" variant="secondary" onPress={() => setCancelling(null)} />
    </View>}
    {!mine && live && myBids.some(b => !b.retracted) && (asking
      ? <View style={ui.card}>
          <Text style={ui.label}>Retirar os meus lances</Text>
          <Text style={ui.text}>Todos os seus lances neste leilão deixam de contar. Só pode fazê-lo 3 vezes em 30 dias.</Text>
          <Chips options={(Object.keys(RETRACT_REASON_LABELS) as RetractReason[]).map(k => ({ value: k, label: RETRACT_REASON_LABELS[k] }))} value={reason} onChange={v => { setReason(v); setError(""); }} />
          <Message error={error} />
          <Button title="Retirar lances" variant="danger" disabled={busy} onPress={() => void retract()} />
          <Button title="Voltar" variant="secondary" onPress={() => setAsking(false)} />
        </View>
      : can.ok ? <Button title="↩️ Retirar o meu lance" variant="secondary" onPress={() => setAsking(true)} />
      : <Text style={ui.muted}>{can.why}</Text>)}
    {!asking && !cancelling && <Message error={error} />}
  </View>;
}
