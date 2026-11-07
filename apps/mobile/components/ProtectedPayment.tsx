import { useEffect, useState } from "react";
import { success } from "../lib/haptics";
import { askForReviewAfterGoodMoment } from "../lib/review";
import { Link } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Linking, Share, Switch, Text, TextInput, View } from "react-native";
import { escrowBuyerStep, escrowSellerStep, canPayOrder, canConfirmReceived, submitOrderPayment, requestPaymentReference, confirmOrderReceived,
  uploadPaymentProof, paymentProofUrl, base64ToArrayBuffer, formatPrice, formatRef, friendlyErrorIn, timeLeftText, ESCROW_STATUS_LABELS, ORDER_PAY_METHOD_LABELS,
  getProtectedSettings, updateProtectedSettings, getEscrowSummary, listOrderPaymentsForAdmin, decideOrderPayment, listPayoutsForAdmin, startPayoutBatch,
  markPayoutsPaid, rejectPayout, payoutsCsv, payoutsTotal, payoutDaysText, PAYOUT_STATUS_LABELS, PAYOUT_METHOD_LABELS,
  type ProtectedOrderFields, type OrderPayMethod, type PlatformSettings, type ProtectedSettings, type EscrowSummary, type AdminOrderPayment,
  type AdminPayout, type PayoutStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { shrinkAsset } from "../lib/image";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { PaymentDetails } from "./Plans";
import { useT, formatDateTimeIn } from "../lib/i18n";

type Ref = { entity: string; reference: string; amount: number | string; expires_at: string | null };

/** Pagar uma encomenda protegida: referência ProxyPay (automático) ou transferência/Express com comprovativo. */
function PayOrder({ order, uid, settings, provider, onDone }: { order: ProtectedOrderFields; uid: string; settings: PlatformSettings | null; provider: "manual" | "proxypay"; onDone: (msg: string) => void }) {
  const { t, tc, lang } = useT();
  const [method, setMethod] = useState<OrderPayMethod>("multicaixa_express");
  const [reference, setReference] = useState(""); const [proof, setProof] = useState<{ uri: string; base64?: string | null; mimeType: string } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [ref, setRef] = useState<Ref | null>(order.payment?.provider === "proxypay" && order.payment.status === "pending" && order.payment.reference
    ? { entity: order.payment.entity ?? "", reference: order.payment.reference, amount: order.payment.amount, expires_at: order.payment.expires_at } : null);
  const code = order.ref_no ? formatRef("order", order.ref_no) : "";
  async function pick(camera: boolean) {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError(camera ? t("sh.allow_camera") : t("sh.allow_gallery")); return; }
    const r = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!r.canceled && r.assets?.[0]) setProof(await shrinkAsset(r.assets[0]));
  }
  async function getReference() {
    setBusy(true); setError("");
    const r = await requestPaymentReference(supabase(), order.id);
    setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setRef(r.data);
  }
  async function send() {
    if (!reference.trim() && !proof) { setError(t("sh.ref_or_proof")); return; }
    setBusy(true); setError("");
    try {
      let path: string | null = null;
      if (proof) {
        const body = proof.base64 ? base64ToArrayBuffer(proof.base64) : await (await fetch(proof.uri)).arrayBuffer();
        const up = await uploadPaymentProof(supabase(), uid, body, "comprovativo.jpg", proof.mimeType || "image/jpeg");
        if (up.error || !up.data) throw up.error ?? new Error(t("sh.proof_upload_failed")); path = up.data;
      }
      const r = await submitOrderPayment(supabase(), order.id, { method, reference, proofPath: path });
      if (r.error) throw r.error;
      onDone(t("sh.proof_sent"));
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  if (provider === "proxypay") return <View style={{ gap: 8 }}>
    {ref ? <View style={[ui.card, { gap: 4 }]}>
      <Text style={ui.text} selectable>{t("sh.entity")} <Text style={ui.h2}>{ref.entity}</Text></Text>
      <Text style={ui.text} selectable>{t("sh.reference")} <Text style={ui.h2}>{ref.reference.replace(/(\d{3})(?=\d)/g, "$1 ")}</Text></Text>
      <Text style={ui.text}>{t("sh.amount")} <Text style={ui.h2}>{formatPrice(ref.amount)}</Text></Text>
      {!!ref.expires_at && <Text style={ui.muted}>{t("sh.valid", { time: tc(timeLeftText(ref.expires_at)) })}</Text>}
    </View> : <Button title={busy ? t("sh.generating") : t("sh.gen_reference")} disabled={busy} onPress={() => void getReference()} />}
    <Text style={ui.muted}>{t("sh.proxypay_hint")}</Text>
    <Message error={error} />
  </View>;
  return <View style={{ gap: 10 }}>
    <Text style={ui.label}>{t("sh.pay_x_to", { price: formatPrice(order.total) })}</Text>
    <PaymentDetails s={settings} />
    {!!code && <Text style={ui.text}>{t("sh.descriptor")} <Text style={ui.label}>{code}</Text>.</Text>}
    <Text style={ui.label}>{"2. " + t("sh.tell_how_paid")}</Text>
    <Chips options={(Object.keys(ORDER_PAY_METHOD_LABELS) as OrderPayMethod[]).map(k => ({ value: k, label: tc(ORDER_PAY_METHOD_LABELS[k]) }))} value={method} onChange={setMethod} />
    <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder={t("sh.ref_ph")} placeholderTextColor={C.muted} accessibilityLabel={t("sh.ref_a11y")} />
    {proof ? <View style={{ gap: 6 }}><Image source={{ uri: proof.uri }} style={{ width: 120, height: 120, borderRadius: 10 }} accessibilityLabel={t("sh.proof")} /><Button title={t("sh.remove_proof")} variant="secondary" onPress={() => setProof(null)} /></View>
      : <View style={ui.row}><Button title={t("sh.photo_proof")} variant="secondary" onPress={() => void pick(true)} /><Button title={t("sh.gallery")} variant="secondary" onPress={() => void pick(false)} /></View>}
    <Text style={ui.muted}>{t("sh.proof_private")}</Text>
    <Message error={error} />
    <Button title={busy ? t("sh.sending") : t("sh.send_proof")} disabled={busy} onPress={() => void send()} />
  </View>;
}

/** Caixa do pagamento protegido dentro de cada encomenda (comprador ou vendedor). */
export function OrderEscrowPanel({ order, role, uid, settings, provider, hasActiveDispute, onChanged }: {
  order: ProtectedOrderFields; role: "buyer" | "seller"; uid: string; settings: PlatformSettings | null; provider: "manual" | "proxypay";
  hasActiveDispute: boolean; onChanged: (msg: string, error?: boolean) => void }) {
  const { t, tc, lang } = useT();
  const [paying, setPaying] = useState(false); const [busy, setBusy] = useState(false);
  if (!order.protected || !order.escrow_status) return null;
  const step = role === "buyer" ? escrowBuyerStep(order, hasActiveDispute) : escrowSellerStep(order);
  async function received() {
    setBusy(true);
    const r = await confirmOrderReceived(supabase(), order.id);
    setBusy(false);
    if (r.error) onChanged(friendlyErrorIn(r.error, lang), true); else { success(); onChanged(t("sh.thanks_released")); void askForReviewAfterGoodMoment(); }
  }
  return <View style={[ui.card, { borderWidth: 2 }]}>
    <Text style={ui.label}>{order.status === "cancelled" && order.escrow_status === "awaiting_payment" ? t("sh.protected_cancelled") : tc(ESCROW_STATUS_LABELS[order.escrow_status])}</Text>
    <Text style={ui.text}>{tc(step)}</Text>
    {role === "buyer" && order.payment?.status === "rejected" && !!order.payment.admin_note && order.escrow_status === "awaiting_payment" && <Text style={ui.error}>{t("sh.last_proof_rejected", { note: order.payment.admin_note })}</Text>}
    {role === "buyer" && canPayOrder(order) && (paying || provider === "proxypay"
      ? <PayOrder order={order} uid={uid} settings={settings} provider={provider} onDone={m => { setPaying(false); onChanged(m); }} />
      : <Button title={t("sh.pay_now")} onPress={() => setPaying(true)} />)}
    {role === "buyer" && canConfirmReceived(order, hasActiveDispute) && <Button title={"✅ " + t("sh.confirm_receipt")} disabled={busy} onPress={() => Alert.alert(t("sh.confirm_receipt"),
      t("sh.confirm_receipt_q"), [{ text: t("sh.no"), style: "cancel" }, { text: t("sh.yes_received"), onPress: () => void received() }])} />}
    {role === "seller" && order.escrow_status === "released" && <Link href={"/conta/saldo" as any} style={ui.link}>{t("sh.view_balance")}</Link>}
  </View>;
}

/** Administração do pagamento protegido: definições, pagamentos por confirmar e levantamentos. */
export function AdminProtected() {
  const { t, tc, lang } = useT();
  const [s, setS] = useState<ProtectedSettings | null>(null); const [sum, setSum] = useState<EscrowSummary | null>(null);
  const [payments, setPayments] = useState<AdminOrderPayment[]>([]); const [payStatus, setPayStatus] = useState<"pending" | "confirmed" | "rejected">("pending");
  const [payouts, setPayouts] = useState<AdminPayout[]>([]); const [poStatus, setPoStatus] = useState<PayoutStatus>("requested");
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const [noteFor, setNoteFor] = useState<string | null>(null); const [note, setNote] = useState(""); const [bankRef, setBankRef] = useState("");
  async function load() {
    const [a, b, c, d] = await Promise.all([getProtectedSettings(supabase()), getEscrowSummary(supabase()), listOrderPaymentsForAdmin(supabase(), payStatus), listPayoutsForAdmin(supabase(), poStatus)]);
    setS(a.data); setSum(b.data); setPayments(c.data); setPayouts(d.data);
    const err = a.error ?? b.error ?? c.error ?? d.error; if (err) setError(friendlyErrorIn(err, lang));
  }
  useEffect(() => { void load(); }, [payStatus, poStatus]);
  async function ok(p: PromiseLike<{ error: any }>, msg: string) {
    setBusy(true); setError(""); setNotice("");
    const r = await p; setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(msg); setNoteFor(null); setNote(""); await load(); }
  }
  function saveSettings() {
    if (!s) return;
    const num = (v: unknown) => Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
    const fee = num(s.protected_fee_pct), days = Number(s.auto_release_days), hours = Number(s.payment_window_hours), min = num(s.payout_min_kz);
    if (!(fee >= 0 && fee <= 20) || !Number.isInteger(days) || days < 1 || days > 30 || !Number.isInteger(hours) || hours < 1 || hours > 168 || !(min >= 0)) { setError(t("sh.check_settings")); return; }
    if (s.payment_provider === "proxypay" && !/^\d{3,6}$/.test(String(s.proxypay_entity ?? ""))) { setError(t("sh.need_entity")); return; }
    if (!s.payout_weekdays?.length) { setError(t("sh.need_day")); return; }
    void ok(updateProtectedSettings(supabase(), { protected_enabled: !!s.protected_enabled, payment_provider: s.payment_provider, proxypay_entity: s.proxypay_entity?.trim() || null,
      protected_fee_pct: fee, auto_release_days: days, payment_window_hours: hours, payout_min_kz: min, payout_weekdays: s.payout_weekdays }), t("sh.settings_saved"));
  }
  async function batch() {
    setError(""); setNotice("");
    const r = await startPayoutBatch(supabase());
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    const list = await listPayoutsForAdmin(supabase(), "processing");
    const rows = list.data.filter(p => p.batch_id === r.data);
    setPoStatus("processing");
    setNotice(t("sh.batch_created"));
    void Share.share({ title: t("sh.share_title"), message: payoutsCsv(rows) });
  }
  const set = (k: keyof ProtectedSettings) => (v: string) => s && setS({ ...s, [k]: v } as ProtectedSettings);
  const toggleDay = (d: number) => s && setS({ ...s, payout_weekdays: (s.payout_weekdays ?? []).includes(d) ? (s.payout_weekdays ?? []).filter(x => x !== d) : [...(s.payout_weekdays ?? []), d].sort() });
  const processing = payouts.filter(p => p.status === "processing");
  return <View style={{ gap: 12 }}>
    <Text style={ui.h2}>{t("sh.protected_tag")}</Text>
    <Text style={ui.text}>{t("sh.protected_admin_intro")}</Text>
    <Message error={error} ok={notice} />
    {!!sum && <View style={ui.card}>
      <Text style={ui.text}>{t("sh.money_held")} <Text style={ui.label}>{formatPrice(sum.held)}</Text></Text>
      <Text style={ui.text}>{t("sh.sellers_balance")} <Text style={ui.label}>{formatPrice(sum.available)}</Text></Text>
      <Text style={ui.text}>{t("sh.payouts_open")} <Text style={ui.label}>{formatPrice(sum.payouts_open)}</Text> {t("sh.payouts_open_detail", { a: sum.payouts_requested, b: sum.payouts_processing })}</Text>
      <Text style={ui.text}>{t("sh.proofs_pending")} <Text style={ui.label}>{sum.payments_pending}</Text> · {t("sh.awaiting_payment", { n: sum.awaiting_payment })}</Text>
      <Text style={ui.text}>{t("sh.refunds_to_send")} <Text style={ui.label}>{sum.refunds_to_send}</Text> {t("sh.in_disputes")}</Text>
      <Text style={ui.text}>{t("sh.fees_30d")} <Text style={ui.label}>{formatPrice(sum.fees_30d)}</Text></Text>
    </View>}

    <Text style={ui.h2}>{t("sh.order_payments")}</Text>
    <Chips options={[{ value: "pending" as const, label: t("sh.to_confirm") }, { value: "confirmed" as const, label: t("sh.confirmed") }, { value: "rejected" as const, label: t("sh.rejected") }]} value={payStatus} onChange={setPayStatus} />
    {payments.length === 0 && <Text style={ui.text}>{t("sh.no_payments")}</Text>}
    {payments.map(p => <View key={p.id} style={ui.card}>
      <Text style={ui.h2}>{formatPrice(p.amount)} · {p.order_ref}</Text>
      <Text style={ui.text}>{t("sh.buyer", { name: p.buyer_name })}{p.buyer_phone ? " · " + p.buyer_phone : ""} · {t("sh.seller", { name: p.seller_name })}</Text>
      <Text style={ui.muted}>{p.provider === "proxypay" ? t("sh.proxypay_line", { entity: p.entity ?? "", ref: p.reference ?? "" }) : `${tc(ORDER_PAY_METHOD_LABELS[p.method as OrderPayMethod] ?? p.method)}${p.reference ? " · " + t("sh.ref", { ref: p.reference }) : ""}`} · {formatDateTimeIn(p.created_at, lang)}</Text>
      {p.paid_amount != null && Number(p.paid_amount) !== Number(p.amount) && <Text style={ui.error}>{t("sh.paid_amount", { price: formatPrice(p.paid_amount) })}</Text>}
      {!!p.admin_note && <Text style={ui.muted}>{t("sh.note", { text: p.admin_note })}</Text>}
      {!!p.proof_path && <Button title={t("sh.view_proof")} variant="secondary" onPress={async () => { const r = await paymentProofUrl(supabase(), p.proof_path!); if (r.data) void Linking.openURL(r.data); else setError(friendlyErrorIn(r.error, lang)); }} />}
      {p.status === "pending" && p.provider === "manual" && (noteFor === p.id ? <>
        <TextInput style={[ui.input, ui.area]} multiline value={note} onChangeText={setNote} placeholder={t("sh.why_not_confirm_buyer")} placeholderTextColor={C.muted} accessibilityLabel={t("sh.reason")} />
        <Button title={t("sh.not_received")} variant="danger" disabled={busy || !note.trim()} onPress={() => void ok(decideOrderPayment(supabase(), p.id, false, note), t("sh.payment_rejected"))} />
        <Button title={t("common.back")} variant="secondary" onPress={() => setNoteFor(null)} />
      </> : <>
        <Button title={t("sh.money_received")} disabled={busy} onPress={() => Alert.alert(t("sh.confirm_payment"), t("sh.confirm_order_payment_q", { price: formatPrice(p.amount), name: p.buyer_name, ref: p.order_ref }),
          [{ text: t("sh.no"), style: "cancel" }, { text: t("common.confirm"), onPress: () => void ok(decideOrderPayment(supabase(), p.id, true), t("sh.order_payment_confirmed")) }])} />
        <Button title={t("sh.not_received")} variant="secondary" onPress={() => { setNoteFor(p.id); setNote(""); }} />
      </>)}
    </View>)}

    <Text style={ui.h2}>{t("sh.sellers_payouts")}</Text>
    <Text style={ui.text}>{t("sh.payout_days_admin", { days: tc(payoutDaysText(s?.payout_weekdays)) })}</Text>
    <Button title={t("sh.create_batch")} disabled={!sum?.payouts_requested} onPress={() => void batch()} />
    <Chips options={(Object.keys(PAYOUT_STATUS_LABELS) as PayoutStatus[]).map(k => ({ value: k, label: tc(PAYOUT_STATUS_LABELS[k]) }))} value={poStatus} onChange={setPoStatus} />
    {poStatus === "processing" && processing.length > 0 && <View style={ui.card}>
      <TextInput style={ui.input} value={bankRef} onChangeText={setBankRef} placeholder={t("sh.batch_ref_ph")} placeholderTextColor={C.muted} accessibilityLabel={t("sh.batch_ref")} />
      <Button title={t("sh.mark_batch_paid", { n: processing.length, price: formatPrice(payoutsTotal(processing)) })} disabled={busy} onPress={() => Alert.alert(t("sh.batch_paid"), t("sh.batch_paid_q"),
        [{ text: t("sh.no"), style: "cancel" }, { text: t("sh.yes"), onPress: () => void ok(markPayoutsPaid(supabase(), processing.map(r => r.id), bankRef), t("sh.payouts_marked_paid")) }])} />
      <Button title={t("sh.share_again")} variant="secondary" onPress={() => void Share.share({ title: t("sh.share_title"), message: payoutsCsv(processing) })} />
    </View>}
    {payouts.length === 0 && <Text style={ui.text}>{t("sh.no_payouts_admin")}</Text>}
    {payouts.map(p => <View key={p.id} style={ui.card}>
      <Text style={ui.h2}>L-{p.ref_no} · {formatPrice(p.amount)}</Text>
      <Text style={ui.label}>{tc(PAYOUT_STATUS_LABELS[p.status])}</Text>
      <Text style={ui.text}>{p.holder_name} ({p.user_name}{p.phone ? " · " + p.phone : ""})</Text>
      <Text style={ui.text} selectable>{tc(PAYOUT_METHOD_LABELS[p.method])}: {p.destination}</Text>
      {!!p.admin_note && <Text style={ui.muted}>{t("sh.note", { text: p.admin_note })}</Text>}
      {(p.status === "requested" || p.status === "processing") && (noteFor === p.id ? <>
        <TextInput style={[ui.input, ui.area]} multiline value={note} onChangeText={setNote} placeholder={t("sh.why_not_payout")} placeholderTextColor={C.muted} accessibilityLabel={t("sh.reason")} />
        <Button title={t("sh.reject_payout_full")} variant="danger" disabled={busy || !note.trim()} onPress={() => void ok(rejectPayout(supabase(), p.id, note), t("sh.payout_rejected"))} />
        <Button title={t("common.back")} variant="secondary" onPress={() => setNoteFor(null)} />
      </> : <Button title={t("sh.reject_payout")} variant="secondary" onPress={() => { setNoteFor(p.id); setNote(""); }} />)}
    </View>)}

    {!!s && <View style={ui.card}>
      <Text style={ui.h2}>{t("sh.settings")}</Text>
      <View style={[ui.row, { alignItems: "center" }]}>
        <Switch value={!!s.protected_enabled} onValueChange={v => setS({ ...s, protected_enabled: v })} accessibilityLabel={t("sh.show_protected")} />
        <Text style={[ui.text, { flex: 1 }]}>{t("sh.show_protected")}</Text>
      </View>
      <Text style={ui.muted}>{t("sh.activate_hint")}</Text>
      <Text style={ui.label}>{t("sh.how_buyers_pay")}</Text>
      <Chips options={[{ value: "manual" as const, label: t("sh.manual_proof") }, { value: "proxypay" as const, label: t("sh.proxypay_ref") }]} value={s.payment_provider ?? "manual"} onChange={v => setS({ ...s, payment_provider: v })} />
      {s.payment_provider === "proxypay" && <><Text style={ui.label}>{t("sh.proxypay_entity")}</Text><TextInput style={ui.input} keyboardType="number-pad" value={s.proxypay_entity ?? ""} onChangeText={set("proxypay_entity")} accessibilityLabel={t("sh.proxypay_entity")} />
        <Text style={ui.muted}>{t("sh.proxypay_secret_hint")}</Text></>}
      <Text style={ui.label}>{t("sh.fee_pct_label")}</Text><TextInput style={ui.input} keyboardType="decimal-pad" value={String(s.protected_fee_pct ?? "")} onChangeText={set("protected_fee_pct")} accessibilityLabel={t("sh.fee_pct_a11y")} />
      <Text style={ui.label}>{t("sh.release_days_label")}</Text><TextInput style={ui.input} keyboardType="number-pad" value={String(s.auto_release_days ?? "")} onChangeText={set("auto_release_days")} accessibilityLabel={t("sh.release_days_a11y")} />
      <Text style={ui.label}>{t("sh.pay_hours_label")}</Text><TextInput style={ui.input} keyboardType="number-pad" value={String(s.payment_window_hours ?? "")} onChangeText={set("payment_window_hours")} accessibilityLabel={t("sh.pay_hours_a11y")} />
      <Text style={ui.label}>{t("sh.min_payout_label")}</Text><TextInput style={ui.input} keyboardType="number-pad" value={String(s.payout_min_kz ?? "")} onChangeText={set("payout_min_kz")} accessibilityLabel={t("sh.min_payout_a11y")} />
      <Text style={ui.label}>{t("sh.payout_days_label")}</Text>
      <View style={ui.row}>{([[1, t("sh.wd1")], [2, t("sh.wd2")], [3, t("sh.wd3")], [4, t("sh.wd4")], [5, t("sh.wd5")], [6, t("sh.wd6")]] as [number, string][]).map(([d, l]) =>
        <Button key={d} title={((s.payout_weekdays ?? []).includes(d) ? "✔ " : "") + l} variant={(s.payout_weekdays ?? []).includes(d) ? "primary" : "secondary"} onPress={() => toggleDay(d)} />)}</View>
      <Button title={t("common.save")} disabled={busy} onPress={saveSettings} />
    </View>}
  </View>;
}
