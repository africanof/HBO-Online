import { useEffect, useState } from "react";
import { Link } from "expo-router";
import { Text, TextInput, View } from "react-native";
import { makeOffer, respondOffer, listOffersFor, validateOffer, offerLabel, parsePrice, friendlyErrorIn, OFFER_STATUS_LABELS, type ListingOffer } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Message } from "./Ui";
import { useT, formatDateTimeIn } from "../lib/i18n";

/** Caixa «Fazer proposta» (dinheiro, troca, ou os dois). */
export function OfferBox({ listingId, uid, offerMoney, offerTrade, tradeOnly, tradeWants }: { listingId: string; uid: string | null; offerMoney: boolean; offerTrade: boolean; tradeOnly: boolean; tradeWants?: string | null }) {
  const { t, tc, lang } = useT();
  const [amount, setAmount] = useState(""); const [trade, setTrade] = useState(""); const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState(false);
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
    {offerMoney && <><Text style={ui.label}>{tradeOnly ? t("ls.offer.extra_money") : t("ls.offer.amount")}</Text>
      <TextInput style={ui.input} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder={t("ls.offer.amount_ph")} /></>}
    <TextInput style={[ui.input, ui.area]} multiline value={message} onChangeText={setMessage} placeholder={t("ls.offer.msg_seller")} />
    <Message error={error} />
    <Button title={busy ? t("ls.sending") : t("ls.offer.send")} disabled={busy} onPress={() => void send()} />
  </View>;
}

/** Propostas recebidas (só o dono do anúncio vê). */
export function OffersList({ listingId }: { listingId: string }) {
  const { t, tc, lang } = useT();
  const [items, setItems] = useState<ListingOffer[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
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
      </>}
    </View>)}
  </View>;
}
