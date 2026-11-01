import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Linking, Pressable, Text, TextInput, View } from "react-native";
import { disputeActions, disputeNextStep, platformRefunds, setDisputeRefundAccount, disputeEventLabel, disputeAction, disputePhotoUrls, uploadDisputePhoto, listDisputesForAdmin, decideDispute,
  base64ToArrayBuffer, formatPrice, friendlyErrorIn, DISPUTE_STATUS_LABELS, DISPUTE_OUTCOME_LABELS, DISPUTE_REASON_LABELS, DISPUTE_REQUEST_LABELS,
  DISPUTE_ACTION_LABELS, DISPUTE_DECISION_LABELS, DISPUTE_MAX_PHOTOS, PAYMENT_LABELS, ORDER_STATUS_LABELS,
  type DisputeAction, type DisputeDecision, type DisputeEvent, type MyDispute, type AdminDispute, type DisputeStatus, type PaymentMethod, type OrderStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { shrinkAsset } from "../lib/image";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { DisputeSummary } from "./AiTools";
import { useT, formatDateTimeIn, type TFn } from "../lib/i18n";

export type Evidence = { uri: string; base64?: string | null; mimeType: string };

/** Fotografar ou escolher até 4 fotografias de prova (reduzidas antes de enviar). */
export function EvidencePicker({ items, onChange, onError }: { items: Evidence[]; onChange: (e: Evidence[]) => void; onError: (m: string) => void }) {
  const { t } = useT();
  async function pick(camera: boolean) {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { onError(camera ? t("sh.allow_camera_problem") : t("sh.allow_gallery")); return; }
    const room = DISPUTE_MAX_PHOTOS - items.length;
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.8, allowsMultipleSelection: !camera, selectionLimit: room };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled || !r.assets?.length) return;
    const ready = await Promise.all(r.assets.slice(0, room).map(a => shrinkAsset(a)));
    onChange([...items, ...ready].slice(0, DISPUTE_MAX_PHOTOS));
  }
  return <View style={{ gap: 8 }}>
    <Text style={ui.label}>{t("sh.photos_n", { n: items.length, max: DISPUTE_MAX_PHOTOS })}</Text>
    {items.length > 0 && <View style={ui.row}>{items.map((p, i) => <Pressable key={p.uri} accessibilityRole="button" accessibilityLabel={t("sh.remove_photo")} onPress={() => onChange(items.filter((_, j) => j !== i))}>
      <Image source={{ uri: p.uri }} style={{ width: 72, height: 72, borderRadius: 8 }} /><Text style={ui.muted}>{t("sh.remove_short")}</Text></Pressable>)}</View>}
    {items.length < DISPUTE_MAX_PHOTOS && <View style={ui.row}>
      <Button title={t("sh.take_photo")} variant="secondary" onPress={() => void pick(true)} />
      <Button title={t("sh.gallery")} variant="secondary" onPress={() => void pick(false)} />
    </View>}
  </View>;
}
export async function uploadEvidence(orderId: string, uid: string, items: Evidence[], failMsg = "Não foi possível enviar a fotografia."): Promise<string[]> {
  const out: string[] = [];
  for (const [i, p] of items.entries()) {
    const body = p.base64 ? base64ToArrayBuffer(p.base64) : await (await fetch(p.uri)).arrayBuffer();
    const r = await uploadDisputePhoto(supabase(), orderId, uid, body, `foto-${i + 1}.jpg`, p.mimeType || "image/jpeg");
    if (r.error || !r.data) throw r.error ?? new Error(failMsg);
    out.push(r.data);
  }
  return out;
}

export function DisputeTimeline({ events }: { events: DisputeEvent[] }) {
  const { t, tc, lang } = useT();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const paths = events.flatMap(e => e.photos ?? []);
  useEffect(() => { if (paths.length) void disputePhotoUrls(supabase(), paths).then(setUrls); }, [paths.join("|")]);
  return <View style={{ gap: 10 }}>
    {events.map((e, i) => <View key={i} style={{ borderLeftWidth: 3, borderLeftColor: C.line, paddingLeft: 10, gap: 4 }}>
      <Text style={ui.label}>{tc(disputeEventLabel(e))}</Text>
      <Text style={ui.muted}>{formatDateTimeIn(e.created_at, lang)}</Text>
      {!!e.note && <Text style={ui.text}>{e.note}</Text>}
      {(e.photos ?? []).length > 0 && <View style={ui.row}>{e.photos.map(p => urls[p]
        ? <Pressable key={p} accessibilityRole="imagebutton" accessibilityLabel={t("sh.open_evidence")} onPress={() => void Linking.openURL(urls[p])}><Image source={{ uri: urls[p] }} style={{ width: 84, height: 84, borderRadius: 8 }} /></Pressable>
        : <Text key={p} style={ui.muted}>{t("sh.photo_placeholder")}</Text>)}</View>}
    </View>)}
  </View>;
}

const statusText = (status: DisputeStatus, outcome: MyDispute["outcome"]) => status === "resolved" && outcome ? DISPUTE_OUTCOME_LABELS[outcome] : DISPUTE_STATUS_LABELS[status];
export const evidenceFail = (t: TFn) => t("sh.photo_upload_failed2");

export function DisputeCard({ d, uid, onChanged }: { d: MyDispute; uid: string; onChanged: (msg: string) => void }) {
  const { t, tc, lang } = useT();
  const [note, setNote] = useState(""); const [photos, setPhotos] = useState<Evidence[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const actions = disputeActions(d, d.my_role);
  const [account, setAccount] = useState(d.refund_to ?? "");
  async function saveAccount() {
    setBusy(true); setError("");
    const r = await setDisputeRefundAccount(supabase(), d.id, account);
    setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else onChanged(t("sh.refund_account_saved"));
  }
  async function send(action: DisputeAction) {
    setBusy(true); setError("");
    try {
      const paths = await uploadEvidence(d.order_id, uid, photos, evidenceFail(t));
      const r = await disputeAction(supabase(), d.id, action, note, paths);
      if (r.error) throw r.error;
      setNote(""); setPhotos([]); onChanged(action === "comment" ? t("sh.message_sent") : t("sh.request_updated"));
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  function run(action: DisputeAction) {
    if (action === "decline" && !note.trim()) { setError(t("sh.why_decline")); return; }
    if (action === "comment" && !note.trim() && !photos.length) { setError(t("sh.message_or_photo")); return; }
    const ask = action === "withdraw" ? t("sh.withdraw_q")
      : action === "confirm_refund" ? t("sh.confirm_refund_q")
      : action === "confirm_replacement" ? t("sh.confirm_replacement_q") : "";
    if (ask) Alert.alert(tc(DISPUTE_ACTION_LABELS[action]), ask, [{ text: t("sh.no"), style: "cancel" }, { text: t("sh.yes"), onPress: () => void send(action) }]);
    else void send(action);
  }
  return <View style={ui.card}>
    <Text style={ui.h2}>{tc(DISPUTE_REASON_LABELS[d.reason])}</Text>
    <Text style={ui.label}>{tc(statusText(d.status, d.outcome))}</Text>
    <Text style={ui.text}>{t(d.my_role === "buyer" ? "sh.seller" : "sh.customer", { name: d.other_name })} · {t("sh.order_of", { price: formatPrice(d.order_total) })}</Text>
    {(d.order_items ?? []).length > 0 && <Text style={ui.muted}>{d.order_items.map(i => `${i.quantity} × ${i.name}`).join(", ")}</Text>}
    <Text style={ui.text}>{t("sh.request_label", { text: tc(DISPUTE_REQUEST_LABELS[d.request]) })}{d.amount != null ? " · " + formatPrice(d.amount) : ""}</Text>
    {!!d.admin_note && <Text style={ui.text}>{t("sh.admin_decision", { text: d.admin_note })}</Text>}
    <Text style={ui.ok}>👉 {tc(disputeNextStep(d, d.my_role))}</Text>
    {platformRefunds(d) && <Text style={ui.text}>{t("sh.protected_held")}</Text>}
    {d.my_role === "buyer" && platformRefunds(d) && d.status !== "resolved" && d.request !== "replacement" && <View style={[ui.card, { gap: 6 }]}>
      <Text style={ui.label}>{t("sh.refund_where")}</Text>
      <TextInput style={ui.input} value={account} onChangeText={setAccount} placeholder={t("sh.refund_account_ph")} placeholderTextColor={C.muted} accessibilityLabel={t("sh.refund_account")} />
      {!!d.refund_to && <Text style={ui.muted}>{t("sh.saved_value", { text: d.refund_to })}</Text>}
      <Button title={t("sh.save_refund_account")} variant="secondary" disabled={busy} onPress={() => void saveAccount()} />
    </View>}
    <Button title={open ? t("sh.hide_history") : t("sh.view_history", { n: d.events.length })} variant="secondary" onPress={() => setOpen(!open)} />
    {open && <DisputeTimeline events={d.events} />}
    {d.status !== "resolved" && <>
      <TextInput style={[ui.input, ui.area]} multiline value={note} onChangeText={setNote} accessibilityLabel={t("sh.message")}
        placeholder={d.my_role === "seller" && d.status === "open" ? t("sh.reply_buyer_ph") : t("sh.write_here_ph")} placeholderTextColor={C.muted} />
      <EvidencePicker items={photos} onChange={setPhotos} onError={setError} />
      <Message error={error} />
      {actions.filter(a => a !== "withdraw").map(a => <Button key={a} disabled={busy} title={tc(DISPUTE_ACTION_LABELS[a])} variant={a === "decline" || a === "escalate" ? "secondary" : "primary"} onPress={() => run(a)} />)}
      <Button disabled={busy} title={"💬 " + tc(DISPUTE_ACTION_LABELS.comment)} variant="secondary" onPress={() => run("comment")} />
      {actions.includes("withdraw") && <Button disabled={busy} title={tc(DISPUTE_ACTION_LABELS.withdraw)} variant="danger" onPress={() => run("withdraw")} />}
    </>}
  </View>;
}

/** Administração: disputas para decidir. */
export function AdminDisputes() {
  const { t, tc, lang } = useT();
  const [status, setStatus] = useState<"escalated" | "escrow_refunds" | "active" | "all">("escalated");
  const [items, setItems] = useState<AdminDispute[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<string | null>(null); const [decision, setDecision] = useState<DisputeDecision>("refund");
  const [amount, setAmount] = useState(""); const [note, setNote] = useState("");
  async function load() { const r = await listDisputesForAdmin(supabase(), status === "all" ? "" : status); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void load(); }, [status]);
  async function decide(d: AdminDispute) {
    if (!note.trim()) { setError(t("sh.explain_decision")); return; }
    const value = decision === "refund" || decision === "return_refund" ? Number(amount.replace(/\s/g, "").replace(",", ".") || d.amount || d.order_total) : null;
    if (value !== null && (!Number.isFinite(value) || value <= 0)) { setError(t("sh.invalid_value")); return; }
    setError(""); setNotice("");
    const r = await decideDispute(supabase(), d.id, decision, note, value);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("sh.decision_saved")); setEditing(null); setNote(""); setAmount(""); await load(); }
  }
  async function refundStep(d: AdminDispute, action: "mark_refunded" | "confirm_refund") {
    if (!note.trim()) { setError(t("sh.write_transfer_ref")); return; }
    setError(""); setNotice("");
    const r = await disputeAction(supabase(), d.id, action, note);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(action === "mark_refunded" ? t("sh.refund_marked") : t("sh.refund_closed")); setNote(""); setEditing(null); await load(); }
  }
  async function comment(d: AdminDispute) {
    if (!note.trim()) { setError(t("sh.write_message")); return; }
    const r = await disputeAction(supabase(), d.id, "comment", note);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("sh.message_sent")); setNote(""); await load(); }
  }
  return <View style={{ gap: 12 }}>
    <Chips options={[{ value: "escalated" as const, label: t("sh.to_decide") }, { value: "escrow_refunds" as const, label: t("sh.refunds_to_send_tab") }, { value: "active" as const, label: t("sh.open") }, { value: "all" as const, label: t("sh.all_m") }]} value={status} onChange={setStatus} />
    <Message error={error} ok={notice} />
    {items.length === 0 && <Text style={ui.text}>{t("sh.no_requests_admin")}</Text>}
    {items.map(d => <View key={d.id} style={ui.card}>
      <Text style={ui.h2}>{tc(DISPUTE_REASON_LABELS[d.reason])}</Text>
      <Text style={ui.label}>{tc(statusText(d.status, d.outcome))}</Text>
      <Text style={ui.text}>{t("sh.buyer", { name: d.buyer_name })} · {t("sh.seller", { name: d.seller_name })}</Text>
      <Text style={ui.muted}>{t("sh.order_of", { price: formatPrice(d.order_total) })} · {tc(ORDER_STATUS_LABELS[d.order_status as OrderStatus] ?? d.order_status)} · {tc(PAYMENT_LABELS[d.payment_method as PaymentMethod] ?? "")}</Text>
      <Text style={ui.text}>{t("sh.request_label", { text: tc(DISPUTE_REQUEST_LABELS[d.request]) })}{d.amount != null ? " · " + formatPrice(d.amount) : ""}</Text>
      {!!d.admin_note && <Text style={ui.text}>{t("sh.decision", { text: d.admin_note })}</Text>}
      {platformRefunds(d) && <Text style={ui.label} selectable>{t("sh.money_held_short")}{d.order_ref ? " · " + d.order_ref : ""} · {t("sh.refund_to", { text: d.refund_to ?? t("sh.buyer_not_set") })}</Text>}
      {platformRefunds(d) && (d.status === "awaiting_refund" || d.status === "refund_sent") && editing === d.id && <>
        {d.status === "awaiting_refund" && <Button title={t("sh.refund_sent_btn")} disabled={!d.refund_to} onPress={() => void refundStep(d, "mark_refunded")} />}
        {d.status === "refund_sent" && <Button title={t("sh.close_refunded")} variant="secondary" onPress={() => void refundStep(d, "confirm_refund")} />}
        <Text style={ui.muted}>{t("sh.write_ref_below")}</Text>
      </>}
      <DisputeTimeline events={d.events} />
      {d.status !== "resolved" && <DisputeSummary disputeId={d.id} />}
      {d.status !== "resolved" && (editing === d.id ? <>
        <Chips options={(Object.keys(DISPUTE_DECISION_LABELS) as DisputeDecision[]).map(k => ({ value: k, label: tc(DISPUTE_DECISION_LABELS[k]) }))} value={decision} onChange={setDecision} />
        {(decision === "refund" || decision === "return_refund") && <TextInput style={ui.input} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} accessibilityLabel={t("sh.refund_value_a11y")} placeholder={t("sh.refund_value_ph", { n: Number(d.amount ?? d.order_total) })} placeholderTextColor={C.muted} />}
        <TextInput style={[ui.input, ui.area]} multiline value={note} onChangeText={setNote} accessibilityLabel={t("sh.explanation")} placeholder={t("sh.explain_or_message")} placeholderTextColor={C.muted} />
        <Button title={t("sh.save_decision")} onPress={() => void decide(d)} />
        <Button title={t("sh.only_message")} variant="secondary" onPress={() => void comment(d)} />
        <Button title={t("common.close")} variant="secondary" onPress={() => setEditing(null)} />
      </> : <Button title={t("sh.decide_or_write")} onPress={() => { setEditing(d.id); setNote(""); setAmount(""); setDecision("refund"); }} />)}
    </View>)}
  </View>;
}
