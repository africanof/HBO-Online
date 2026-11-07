import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { requestRental, getListingAuction, startListingAuction, bidOnAuction, cancelAuction, nextMinimumBid, quickBids, timeLeft,
  formatPrice, parsePrice, friendlyErrorIn, buyAuctionNow, listBidsForAuction, retractMyBid, cancelBidAsSeller, canRetractBid, RETRACT_REASON_LABELS,
  type ListingAuction, type AuctionBid, type RetractReason } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui, C } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { Countdown, withSlot } from "./Countdown";
import { useT, formatDateTimeIn } from "../lib/i18n";

/** Pedido de aluguer (anúncios para arrendar/alugar). Datas no formato AAAA-MM-DD. */
export function RentalRequestForm({ listingId, uid, defaultPrice }: { listingId: string; uid: string | null; defaultPrice?: number | null }) {
  const router = useRouter(); const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(""); const [end, setEnd] = useState(""); const [price, setPrice] = useState(defaultPrice != null ? String(defaultPrice) : "");
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [ok, setOk] = useState("");
  async function submit() {
    if (!uid) { router.push("/login" as any); return; }
    setBusy(true); setError(""); setOk("");
    const r = await requestRental(supabase(), { listingId, startsAt: start, endsAt: end, price: parsePrice(price) ?? 0, message });
    setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setOk(t("ls.rentreq.sent")); setOpen(false); }
  }
  if (!open) return <View style={{ gap: 8 }}><Message ok={ok} /><Button title={"📅 " + t("ls.rentreq.title")} onPress={() => setOpen(true)} /></View>;
  return <View style={ui.card}>
    <Text style={ui.h2}>{t("ls.rentreq.title")}</Text>
    <Text style={ui.label}>{t("ls.rentreq.from")}</Text>
    <TextInput style={ui.input} value={start} onChangeText={setStart} placeholder="2026-11-01" keyboardType="numbers-and-punctuation" accessibilityLabel={t("ls.rentreq.start")} />
    <Text style={ui.label}>{t("ls.rentreq.to")}</Text>
    <TextInput style={ui.input} value={end} onChangeText={setEnd} placeholder="2026-11-30" keyboardType="numbers-and-punctuation" accessibilityLabel={t("ls.rentreq.end")} />
    <Text style={ui.label}>{t("ls.rentreq.total")}</Text>
    <TextInput style={ui.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
    <Text style={ui.label}>{t("ls.rentreq.message")}</Text>
    <TextInput style={[ui.input, ui.area]} multiline value={message} onChangeText={setMessage} />
    <Message error={error} />
    <Button title={busy ? t("ls.sending") : t("ls.rentreq.send")} disabled={busy} onPress={() => void submit()} />
    <Button title={t("common.cancel")} variant="secondary" onPress={() => setOpen(false)} />
  </View>;
}

/** Leilão do anúncio: ver, licitar, ou (dono) iniciar/cancelar. */
export function AuctionPanel({ listingId, uid, mine, canStart }: { listingId: string; uid: string | null; mine: boolean; canStart: boolean }) {
  const router = useRouter(); const { t, tc, lang } = useT();
  const [a, setA] = useState<ListingAuction | null>(null); const [loaded, setLoaded] = useState(false);
  const [amount, setAmount] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [ok, setOk] = useState("");
  const [form, setForm] = useState({ open: false, starting: "", reserve: "", increment: "", days: "7", buyNow: "" });
  async function load() { const r = await getListingAuction(supabase(), listingId); setA((r.data as ListingAuction) ?? null); setLoaded(true); }
  useEffect(() => { void load(); }, [listingId]);
  async function run(fn: () => PromiseLike<{ error: any }>, msg: string) {
    setBusy(true); setError(""); setOk("");
    const r = await fn(); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setOk(msg); setAmount(""); setForm(f => ({ ...f, open: false })); await load(); }
  }
  async function placeMax() {
    if (!a) return;
    setBusy(true); setError(""); setOk("");
    const r = await bidOnAuction(supabase(), a.id, parsePrice(amount) ?? NaN);
    if (r.error) { setBusy(false); setError(friendlyErrorIn(r.error, lang)); return; }
    const fresh = (await getListingAuction(supabase(), listingId)).data as ListingAuction | null;
    setBusy(false); setAmount(""); if (fresh) setA(fresh);
    setOk(fresh?.leader_is_me ? t("ls.auc.winning_with", { price: formatPrice(fresh.current_price), max: formatPrice(fresh.my_best) }) : "");
    if (fresh && !fresh.leader_is_me) setError(t("ls.auc.outbid_now", { price: formatPrice(fresh.current_price) }));
  }
  if (!loaded) return null;
  const live = !!a && a.status === "live" && new Date(a.ends_at).getTime() > Date.now();

  if (!a || a.status === "cancelled") {
    if (!mine || !canStart) return null;
    if (!form.open) return <View style={{ gap: 8 }}><Message ok={ok} /><Button title={"🔨 " + t("ls.auc.start_title")} variant="secondary" onPress={() => setForm({ ...form, open: true })} /></View>;
    return <View style={ui.card}>
      <Text style={ui.h2}>{t("ls.auc.start_title")}</Text>
      <Text style={ui.label}>{t("ls.auc.starting")}</Text>
      <TextInput style={ui.input} keyboardType="decimal-pad" value={form.starting} onChangeText={v => setForm({ ...form, starting: v })} />
      <Text style={ui.label}>{t("ls.auc.reserve")}</Text>
      <TextInput style={ui.input} keyboardType="decimal-pad" value={form.reserve} onChangeText={v => setForm({ ...form, reserve: v })} />
      <Text style={ui.label}>{t("ls.auc.buy_now_price")}</Text>
      <TextInput style={ui.input} keyboardType="decimal-pad" value={form.buyNow} onChangeText={v => setForm({ ...form, buyNow: v })} accessibilityLabel={t("ls.auc.buy_now_a11y")} placeholder={t("ls.auc.buy_now_ph")} />
      <Text style={ui.label}>{t("ls.auc.increment")}</Text>
      <TextInput style={ui.input} keyboardType="decimal-pad" value={form.increment} onChangeText={v => setForm({ ...form, increment: v })} placeholder={t("ls.auc.increment_ph")} />
      <Text style={ui.label}>{t("ls.auc.length")}</Text>
      <Chips options={["1", "3", "5", "7", "10", "14"].map(d => ({ value: d, label: t("ls.auc.days", { n: d }) }))} value={form.days} onChange={v => setForm({ ...form, days: v })} />
      <Message error={error} />
      <Button title={t("ls.auc.start")} disabled={busy} onPress={() => void run(() => startListingAuction(supabase(), listingId, {
        startingPrice: parsePrice(form.starting) ?? NaN, reservePrice: parsePrice(form.reserve), minIncrement: parsePrice(form.increment), days: Number(form.days), buyNowPrice: parsePrice(form.buyNow) }), t("ls.auc.started"))} />
      <Button title={t("common.cancel")} variant="secondary" onPress={() => setForm({ ...form, open: false })} />
    </View>;
  }

  return <View style={ui.card} accessibilityLabel={t("tag.auction")}>
    <Text style={ui.h2}>{live ? t("ls.auc.live") : a.status === "scheduled" ? t("ls.auc.scheduled") : t("ls.auc.ended")}</Text>
    <Text style={ui.price}>{formatPrice(a.current_price)}</Text>
    <Text style={ui.text}>{t("ls.bids.count", { n: a.bid_count })} · {live ? withSlot(t("ls.bids.ends_in", { time: "\u0000" }), <Countdown endsAt={a.ends_at} onEnd={() => void load()} />) : t("ls.auc.ended_at", { date: formatDateTimeIn(a.ends_at, lang) })}{!a.reserve_met && a.bid_count > 0 ? " · " + t("ls.auc.reserve_not_met") : ""}</Text>
    {a.status === "ended" && <Text style={ui.label}>{a.winner_id ? (a.winner_id === uid ? (a.bought_now ? t("ls.auc.you_bought") : t("ls.auc.you_won")) : a.bought_now ? t("ls.auc.sold_buy_now") : t("ls.auc.sold")) : a.has_reserve && a.bid_count > 0 ? t("ls.auc.no_reserve") : t("ls.auc.no_winner")}</Text>}
    {live && a.buy_now_available && a.buy_now_price != null && (mine
      ? <Text style={ui.text}>{t("ls.auc.buy_now_owner", { price: formatPrice(a.buy_now_price) })}</Text>
      : <View style={{ gap: 6 }}>
          <Text style={ui.text}>{t("ls.auc.buy_now_text", { price: formatPrice(a.buy_now_price) })}</Text>
          <Button title={t("ls.auc.buy_now_btn", { price: formatPrice(a.buy_now_price) })} disabled={busy} onPress={() => { if (!uid) { router.push("/login" as any); return; } Alert.alert(t("ls.auc.buy_now"), t("ls.auc.buy_now_q", { price: formatPrice(a.buy_now_price) }), [{ text: t("ls.no") }, { text: t("ls.auc.buy"), onPress: () => void run(() => buyAuctionNow(supabase(), a.id), t("ls.auc.bought")) }]); }} />
        </View>)}
    {live && !mine && <>
      {a.leader_is_me ? <Text style={ui.ok}>{t("ls.auc.winning", { max: formatPrice(a.my_best) })}</Text>
        : a.my_best != null ? <Text style={ui.error}>{t("ls.auc.outbid")}</Text> : null}
      <Text style={ui.text}>{t("ls.auc.how")}</Text>
      <Text style={ui.label}>{a.leader_is_me ? t("ls.auc.new_max") : t("ls.auc.your_max")}</Text>
      <TextInput style={ui.input} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder={t("ls.auc.min", { price: formatPrice(nextMinimumBid(a)) })} accessibilityLabel={a.leader_is_me ? t("ls.auc.new_max") : t("ls.auc.your_max")} />
      {quickBids(a).length > 0 && <View style={{ flexDirection: "row", gap: 8 }}>
        {quickBids(a).map(v => { const on = parsePrice(amount) === v; return <Pressable key={v} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setAmount(String(v))}
          style={{ flex: 1, minHeight: 46, borderRadius: 999, borderWidth: 2, borderColor: C.blue, backgroundColor: on ? C.blue : C.white, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: on ? C.onAccent : C.blue, fontWeight: "800", fontSize: 15 }}>{formatPrice(v)}</Text></Pressable>; })}
      </View>}
      <Button title={a.leader_is_me ? t("ls.auc.raise") : t("ls.auc.bid")} disabled={busy} onPress={() => { if (!uid) { router.push("/login" as any); return; } void placeMax(); }} />
    </>}
    {a.status !== "scheduled" && <BidHistory auction={a} mine={mine} uid={uid} version={a.current_price + ":" + a.bid_count} onChanged={m => { setOk(m); void load(); }} />}
    {mine && live && a.bid_count === 0 && <Button title={t("ls.auc.cancel")} variant="secondary" disabled={busy} onPress={() => Alert.alert(t("ls.auc.cancel_q"), "", [{ text: t("ls.no") }, { text: t("ls.yes"), onPress: () => void run(() => cancelAuction(supabase(), a.id), t("ls.auc.cancelled")) }])} />}
    <Message error={error} ok={ok} />
  </View>;
}

/** Lances do leilão: retirar os meus (com motivo) ou, para o vendedor, cancelar os de uma pessoa. */
function BidHistory({ auction, mine, uid, version, onChanged }: { auction: ListingAuction; mine: boolean; uid: string | null; version: string; onChanged: (msg: string) => void }) {
  const { t, tc, lang } = useT();
  const [bids, setBids] = useState<AuctionBid[]>([]); const [open, setOpen] = useState(false); const [error, setError] = useState("");
  const [reason, setReason] = useState<RetractReason | "">(""); const [asking, setAsking] = useState(false); const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState<AuctionBid | null>(null); const [why, setWhy] = useState("");
  async function load() { const r = await listBidsForAuction(supabase(), auction.id); if (!r.error) setBids(r.data); }
  useEffect(() => { void load(); }, [auction.id, version, uid]);
  const live = auction.status === "live" && new Date(auction.ends_at).getTime() > Date.now();
  const myBids = bids.filter(b => b.is_mine);
  const can = canRetractBid(auction, myBids);
  async function retract() {
    if (!reason) { setError(t("ls.bh.pick_reason")); return; }
    setBusy(true); setError("");
    const r = await retractMyBid(supabase(), auction.id, reason); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setAsking(false); setReason(""); onChanged(t("ls.bh.retracted_ok")); await load(); }
  }
  async function cancel() {
    if (!cancelling) return;
    if (!why.trim()) { setError(t("ls.bh.why_needed")); return; }
    setBusy(true); setError("");
    const r = await cancelBidAsSeller(supabase(), cancelling.id, why); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setCancelling(null); setWhy(""); onChanged(t("ls.bh.cancelled_ok")); await load(); }
  }
  if (!bids.length) return null;
  return <View style={{ gap: 8 }}>
    <Button title={open ? t("ls.bh.hide") : t("ls.bh.show", { n: bids.filter(b => !b.retracted).length })} variant="secondary" onPress={() => setOpen(!open)} />
    {open && bids.map(b => <View key={b.id} style={{ gap: 4, opacity: b.retracted ? 0.7 : 1 }}>
      <Text style={ui.text}><Text style={ui.label}>{tc(b.bidder_label)}</Text>{b.is_auto ? " " + t("ls.bh.auto") : ""} · <Text style={b.retracted ? { textDecorationLine: "line-through" } : undefined}>{formatPrice(b.amount)}</Text> · {formatDateTimeIn(b.created_at, lang)}</Text>
      {b.retracted && <Text style={ui.muted}>{b.retracted_by_seller ? t("ls.bh.by_seller") : t("ls.bh.retracted")}{b.retract_reason ? ": " + tc(b.retract_reason) : ""}</Text>}
      {mine && live && !b.retracted && <Button title={t("ls.bh.cancel_of", { name: tc(b.bidder_label) })} variant="secondary" onPress={() => { setCancelling(b); setWhy(""); setError(""); }} />}
    </View>)}
    {cancelling && <View style={ui.card}>
      <Text style={ui.label}>{t("ls.bh.cancel_of_title", { name: tc(cancelling.bidder_label) })}</Text>
      <TextInput style={[ui.input, ui.area]} multiline value={why} onChangeText={setWhy} accessibilityLabel={t("ls.bh.reason")} placeholder={t("ls.bh.reason_ph")} />
      <Message error={error} />
      <Button title={t("ls.bh.cancel_bids")} variant="danger" disabled={busy} onPress={() => void cancel()} />
      <Button title={t("common.back")} variant="secondary" onPress={() => setCancelling(null)} />
    </View>}
    {!mine && live && myBids.some(b => !b.retracted) && (asking
      ? <View style={ui.card}>
          <Text style={ui.label}>{t("ls.bh.retract_title")}</Text>
          <Text style={ui.text}>{t("ls.bh.retract_text")}</Text>
          <Chips options={(Object.keys(RETRACT_REASON_LABELS) as RetractReason[]).map(k => ({ value: k, label: tc(RETRACT_REASON_LABELS[k]) }))} value={reason} onChange={v => { setReason(v); setError(""); }} />
          <Message error={error} />
          <Button title={t("ls.bh.retract_bids")} variant="danger" disabled={busy} onPress={() => void retract()} />
          <Button title={t("common.back")} variant="secondary" onPress={() => setAsking(false)} />
        </View>
      : can.ok ? <Button title={t("ls.bh.retract_mine")} variant="secondary" onPress={() => setAsking(true)} />
      : <Text style={ui.muted}>{tc(can.why ?? "")}</Text>)}
    {!asking && !cancelling && <Message error={error} />}
  </View>;
}
