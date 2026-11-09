import { useEffect, useState } from "react";
import { Link } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";
import { makeOffer, respondOffer, counterOffer, listOffersFor, validateOffer, offerLabel, parsePrice, friendlyErrorIn, offerQuickAmounts, offersLeftToday, formatPrice, OFFER_STATUS_LABELS, type ListingOffer } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Message } from "./Ui";
import { useT, formatDateTimeIn } from "../lib/i18n";

/** Caixa «Fazer proposta» (dinheiro, troca, ou os dois). */
export function OfferBox({ listingId, uid, offerMoney, offerTrade, tradeOnly, tradeWants, price, currency }: { listingId: string; uid: string | null; offerMoney: boolean; offerTrade: boolean; tradeOnly: boolean; tradeWants?: string | null; price?: number | null; currency?: string | null }) {
  const { t, tc, lang } = useT();
  const [amount, setAmount] = useState(""); const [trade, setTrade] = useState(""); const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState(false);
  const [left, setLeft] = useState<number | null>(null); const [custom, setCustom] = useState(false);
  useEffect(() => { if (uid) void offersLeftToday(supabase()).then(setLeft); }, [uid]);
  const quick = !tradeOnly && offerMoney ? offerQuickAmounts(price) : [];
  const typed = amount.trim() ? parsePrice(amount) : undefined; const cur = currency ?? "AOA";
  async function send() {
    if (!uid) { setError(t("ls.offer.sign_in")); return; }
    const value = amount.trim() ? parsePrice(amount) ?? NaN : undefined;
    const v = validateOffer({ amount: value, tradeItem: trade }, { offerMoney, offerTrade, tradeOnly }); if (v) { setError(tc(v)); return; }
    setBusy(true); setError("");
    const r = await makeOffer(supabase(), listingId, { amount: value, tradeItem: offerTrade ? trade : undefined, message }); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setDone(true);
  }
  if (done) return <View style={ui.card}><Text style={ui.ok}>{t("ls.offer.sent")}</Text><Link href={"/propostas" as any} style={ui.link}>{t("ls.offers.title")} →</Link></View>;
  return <View style={ui.card}>
    <Text style={ui.h2}>{tradeOnly ? t("ls.offer.propose_trade") : offerTrade ? t("ls.offer.make_or_trade") : t("ls.offer.make")}</Text>
    {!!tradeWants && <Text style={ui.text}>{t("ls.offer.seller_accepts")} <Text style={ui.label}>{tradeWants}</Text></Text>}
    {offerTrade && <><Text style={ui.label}>{tradeOnly ? t("ls.offer.trade_what") : t("ls.offer.trade_what_opt")}</Text>
      <TextInput style={ui.input} value={trade} maxLength={300} onChangeText={setTrade} placeholder={t("ls.offer.trade_ph")} /></>}
    {!!price && price > 0 && !tradeOnly && <Text style={ui.muted}>{t("off.price", { price: formatPrice(price, cur) })}</Text>}
    {quick.length > 0 && <View style={{ flexDirection: "row", gap: 8 }}>
      {quick.map(q => { const on = !custom && typed === q.amount; return <Pressable key={q.pct} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => { setCustom(false); setAmount(String(q.amount)); }}
        style={{ flex: 1, borderWidth: on ? 2 : 1, borderColor: on ? C.blue : C.line, backgroundColor: on ? C.blueSoft : C.card, borderRadius: 12, padding: 10, minHeight: 70, gap: 2 }}>
        <Text style={[ui.label, { fontSize: 15 }]} numberOfLines={1} adjustsFontSizeToFit>{formatPrice(q.amount, cur)}</Text><Text style={{ color: C.blue, fontWeight: "600", fontSize: 13 }}>{t("off.pct", { pct: q.pct })}</Text></Pressable>; })}
      <Pressable accessibilityRole="radio" accessibilityState={{ checked: custom }} onPress={() => { setCustom(true); setAmount(""); }}
        style={{ flex: 1, borderWidth: custom ? 2 : 1, borderColor: custom ? C.blue : C.line, backgroundColor: custom ? C.blueSoft : C.card, borderRadius: 12, padding: 10, minHeight: 70, gap: 2 }}>
        <Text style={[ui.label, { fontSize: 15 }]}>{t("off.custom")}</Text><Text style={{ color: C.blue, fontWeight: "600", fontSize: 13 }}>{t("off.custom_hint")}</Text></Pressable>
    </View>}
    {offerMoney && (custom || quick.length === 0 || tradeOnly) && <><Text style={ui.label}>{tradeOnly ? t("ls.offer.extra_money") : t("ls.offer.amount")}</Text>
      <TextInput style={ui.input} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder={t("ls.offer.amount_ph")} /></>}
    {!tradeOnly && typed != null && typed > 0 && <Text style={ui.muted}>{t("off.total", { amount: formatPrice(typed, cur) })}</Text>}
    <TextInput style={[ui.input, ui.area]} multiline value={message} onChangeText={setMessage} placeholder={t("ls.offer.msg_seller")} />
    <Message error={error} />
    <Button title={busy ? t("ls.sending") : t("ls.offer.send")} disabled={busy || left === 0} onPress={() => void send()} />
    {left != null && <Text style={ui.muted}>{t("off.left", { n: left })}</Text>}
  </View>;
}

/** Propostas recebidas (só o dono do anúncio vê). */
export function OffersList({ listingId, price }: { listingId: string; price?: number | null }) {
  const { t, tc, lang } = useT();
  const [items, setItems] = useState<ListingOffer[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({}); const [counters, setCounters] = useState<Record<string, string>>({});
  async function counter(o: ListingOffer) {
    const v = parsePrice(counters[o.id] ?? ""); if (!v) { setError(t("off.counter_q", { offer: formatPrice(o.amount), price: price ? formatPrice(price) : "—" })); return; }
    setError(""); setNotice("");
    const r = await counterOffer(supabase(), o.id, v, notes[o.id]);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("off.counter_sent")); await load(); }
  }
  async function load() { const r = await listOffersFor(supabase(), listingId); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void load(); }, [listingId]);
  async function answer(o: ListingOffer, accept: boolean) {
    setError(""); setNotice("");
    const r = await respondOffer(supabase(), o.id, accept, notes[o.id]);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(accept ? t("ls.offer.accepted") : t("ls.offer.declined")); await load(); }
  }
  return <View style={ui.card}>
    <Text style={ui.h2}>{t("ls.offer.received", { n: items.filter(o => o.status === "pending").length })}</Text>
    <Message error={error} ok={notice} />
    {items.length === 0 && <Text style={ui.text}>{t("ls.offer.none")}</Text>}
    {items.map(o => <View key={o.id} style={[ui.card, { backgroundColor: C.surface }]}>
      <Text style={ui.h2}>{tc(offerLabel(o))}</Text>
      <Link href={("/vendedor/" + o.buyer_id) as any} style={ui.link}>{o.buyer_name} →</Link>
      <Text style={ui.muted}>{formatDateTimeIn(o.created_at, lang)} · {tc(OFFER_STATUS_LABELS[o.status])}</Text>
      {!!o.message && <Text style={ui.text}>💬 {o.message}</Text>}
      {!!o.seller_note && <Text style={ui.text}>{t("ls.offer.your_reply", { note: o.seller_note })}</Text>}
      {o.status === "pending" && <>
        <TextInput style={ui.input} value={notes[o.id] ?? ""} onChangeText={v => setNotes(n => ({ ...n, [o.id]: v }))} placeholder={t("ls.offer.msg_buyer")} />
        <Button title={"✔ " + t("ls.accept")} onPress={() => void answer(o, true)} />
        <Button title={"✖ " + t("ls.decline")} variant="danger" onPress={() => void answer(o, false)} />
        {o.amount != null && <><TextInput style={ui.input} keyboardType="decimal-pad" value={counters[o.id] ?? ""} onChangeText={v => setCounters(c => ({ ...c, [o.id]: v }))} placeholder={t("off.counter_q", { offer: formatPrice(o.amount), price: price ? formatPrice(price) : "—" })} />
          <Button title={t("off.counter")} variant="secondary" onPress={() => void counter(o)} /></>}
      </>}
      {o.status === "countered" && o.counter_amount != null && <Text style={ui.text}>{t("off.your_counter", { amount: formatPrice(o.counter_amount) })}</Text>}
    </View>)}
  </View>;
}
