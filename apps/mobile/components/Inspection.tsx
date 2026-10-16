import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Alert, Image, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { inspectedMap, inspectionBadgeText, isInspected, requestInspection, cancelInspection, myInspections, listInspectionsForAdmin, scheduleInspection,
  decideInspection, revokeInspection, hasStore, inspectionFee, submitInspectionPayment, decideInspectionPayment, INSPECTION_FEE_NOTE, paymentProofUrl, uploadPaymentProof,
  base64ToArrayBuffer, formatPrice, PLAN_METHOD_LABELS, type PaymentMethodPlan, getProvider, listMyBusinesses, getPlatformSettings, updatePlatformSettings, friendlyErrorIn, inspectionRef, scheduledText,
  INSPECTION_BADGE, INSPECTION_EXPLAINED, INSPECTION_KIND_LABELS, INSPECTION_STATUS_LABELS, INSPECTION_CHECKLIST,
  type InspectedInfo, type InspectionKind, type InspectionStatus, type MyInspection, type AdminInspection, type PlatformSettings } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { PaymentDetails } from "./Plans";
import { shrinkAsset } from "../lib/image";
import { useT } from "../lib/i18n";

const ph = { placeholderTextColor: C.muted };
const Field = ({ label, ...p }: { label: string } & React.ComponentProps<typeof TextInput>) =>
  <View style={{ gap: 4 }}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} style={ui.input} {...ph} {...p} /></View>;

/** 🏅 Selo «Inspecionado» (só aparece se estiver válido). */
export function InspectedBadge({ info, big }: { info?: InspectedInfo | null; big?: boolean }) {
  const { tc } = useT();
  if (!isInspected(info)) return null;
  const pill = <Text style={{ alignSelf: "flex-start", color: C.greenText, backgroundColor: C.greenSoft, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 2, fontWeight: "800" }}>{tc(INSPECTION_BADGE)}</Text>;
  return big ? <View style={[ui.card, { gap: 4, borderColor: C.green }]}>{pill}<Text style={ui.text}>{tc(INSPECTION_EXPLAINED)}</Text><Text style={ui.muted}>{tc(inspectionBadgeText(info))}</Text></View> : pill;
}
export function useInspected(kind: InspectionKind, ids: (string | null | undefined)[]) {
  const [map, setMap] = useState<Record<string, InspectedInfo>>({});
  const key = ids.filter(Boolean).join(",");
  useEffect(() => { if (key) void inspectedMap(supabase(), kind, ids).then(setMap); }, [kind, key]);
  return map;
}

type Target = { kind: InspectionKind; id: string; name: string };
const KINDS: InspectionKind[] = ["provider", "business", "store"];

export function MyInspectionsScreen() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [targets, setTargets] = useState<Target[] | null>(null);
  const [items, setItems] = useState<MyInspection[]>([]); const [badges, setBadges] = useState<Record<string, InspectedInfo>>({});
  const [open, setOpen] = useState<string | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  async function load(u: string) {
    const c = supabase();
    const [p, b, s, m, st] = await Promise.all([getProvider(c, u), listMyBusinesses(c, u), hasStore(c, u), myInspections(c), getPlatformSettings(c)]);
    setSettings(st.data);
    const tg: Target[] = [];
    if (p.data) tg.push({ kind: "provider", id: u, name: (p.data as any).display_name });
    for (const x of (b.data ?? []) as any[]) tg.push({ kind: "business", id: x.id, name: x.name });
    if (s) tg.push({ kind: "store", id: u, name: t("sv.my_store") });
    setTargets(tg); setItems(m.data);
    const maps = await Promise.all(KINDS.map(k => inspectedMap(c, k, tg.filter(x => x.kind === k).map(x => x.id))));
    setBadges(Object.fromEntries(tg.map(x => [x.kind + x.id, maps[KINDS.indexOf(x.kind)][x.id]]).filter(([, v]) => v)));
  }
  useFocusEffect(useCallback(() => { void currentUserId().then(u => { setUid(u); if (u) void load(u); }); }, []));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></View>;
  if (!uid) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>{t("sv.in_title")}</Text><Button title={t("auth.login")} onPress={() => router.push("/login")} /></ScrollView>;
  async function cancel(i: MyInspection) { const r = await cancelInspection(supabase(), i.id); if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("sv.in_cancelled")); void load(uid!); } }
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Text style={ui.h1}>{t("sv.in_title")}</Text>
    <Text style={ui.text}>{tc(INSPECTION_EXPLAINED)}{t("sv.in_intro_more")}</Text>
    <Text style={ui.muted}>{t("sv.in_diff")}</Text>
    <View style={ui.card}><Text style={ui.text}>{t("sv.in_fee", { a: formatPrice(inspectionFee("provider", settings)), b: formatPrice(inspectionFee("business", settings)) })}</Text>
      <Text style={ui.muted}>{tc(INSPECTION_FEE_NOTE)}</Text></View>
    <Message error={error} ok={notice} />
    {targets === null ? <Text style={ui.text}>{t("common.loading")}</Text> : targets.length === 0 ? <Text style={ui.text}>{t("sv.in_no_targets")}</Text> :
      targets.map(tg => { const k = tg.kind + tg.id; const last = items.find(i => i.kind === tg.kind && i.target_id === tg.id);
        const busy = !!last && ["awaiting_payment", "payment_submitted", "requested", "scheduled"].includes(last.status);
        const canCancel = !!last && (last.status === "awaiting_payment" || (last.fee_amount === 0 && (last.status === "requested" || last.status === "scheduled")));
        return <View key={k} style={ui.card}>
          <Text style={ui.h2}>{tc(INSPECTION_KIND_LABELS[tg.kind])} · {tg.name}</Text>
          <InspectedBadge info={badges[k]} big />
          {!!last && <Text style={ui.text}>{inspectionRef(last.ref_no)} · {tc(INSPECTION_STATUS_LABELS[last.status])}{last.status === "scheduled" && last.scheduled_for ? " — " + tc(scheduledText(last.scheduled_for)) : ""}</Text>}
          {!!last?.admin_note && (last.status === "rejected" || last.status === "revoked" || last.status === "scheduled" || last.status === "awaiting_payment") && <Text style={last.status === "scheduled" ? ui.text : ui.error}>{t("sv.admin_note", { note: last.admin_note })}</Text>}
          {last?.status === "awaiting_payment" && <PayBox i={last} uid={uid} settings={settings} onDone={m => { setNotice(m); setError(""); void load(uid!); }} />}
          {busy ? !canCancel ? null : <Button title={t("sv.srv_cancel")} variant="secondary" onPress={() => Alert.alert(t("sv.in_cancel_q"), "", [{ text: t("sv.no"), style: "cancel" }, { text: t("common.cancel"), onPress: () => void cancel(last!) }])} />
            : open === k ? <RequestForm tg={tg} onDone={m => { setOpen(null); setNotice(m); setError(""); void load(uid!); }} onClose={() => setOpen(null)} />
            : <Button title={t(badges[k] ? "sv.in_request_again" : "sv.in_request", { fee: formatPrice(inspectionFee(tg.kind, settings)) })} onPress={() => setOpen(k)} />}
        </View>; })}
  </ScrollView>;
}
function RequestForm({ tg, onDone, onClose }: { tg: Target; onDone: (m: string) => void; onClose: () => void }) {
  const { t, tc, lang } = useT();
  const [address, setAddress] = useState(""); const [phone, setPhone] = useState(""); const [when, setWhen] = useState(""); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function send() {
    setBusy(true); setError("");
    const r = await requestInspection(supabase(), tg.kind, tg.id, { address, phone, preferredTime: when, note }); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else onDone(t("sv.in_created"));
  }
  return <View style={{ gap: 8 }}>
    <Text style={ui.muted}>{tc(INSPECTION_FEE_NOTE)}</Text>
    <Field label={t("sv.in_address")} value={address} onChangeText={setAddress} maxLength={300} multiline placeholder={t("sv.in_address_ph")} />
    <Field label={t("sv.in_phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} />
    <Field label={t("sv.in_when")} value={when} onChangeText={setWhen} maxLength={120} placeholder={t("sv.in_when_ph")} />
    <Field label={t("sv.note_opt")} value={note} onChangeText={setNote} maxLength={500} />
    <Message error={error} />
    <Button title={busy ? t("sv.sending") : t("sv.send_request_ok")} disabled={busy} onPress={() => void send()} />
    <Button title={t("common.cancel")} variant="secondary" onPress={onClose} />
  </View>;
}

function PayBox({ i, uid, settings, onDone }: { i: MyInspection; uid: string; settings: PlatformSettings | null; onDone: (m: string) => void }) {
  const { t, tc, lang } = useT();
  const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express"); const [reference, setReference] = useState("");
  const [proof, setProof] = useState<{ uri: string; base64?: string | null; mimeType: string } | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function pick(camera: boolean) {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError(camera ? t("sv.cam_perm") : t("sv.gallery_perm")); return; }
    const r = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!r.canceled && r.assets?.[0]) setProof(await shrinkAsset(r.assets[0]));
  }
  async function send() {
    if (!reference.trim() && !proof) { setError(t("sv.pay_need_ref")); return; }
    setBusy(true); setError("");
    try {
      let path: string | null = null;
      if (proof) { const body = proof.base64 ? base64ToArrayBuffer(proof.base64) : await (await fetch(proof.uri)).arrayBuffer();
        const up = await uploadPaymentProof(supabase(), uid, body, "comprovativo.jpg", proof.mimeType || "image/jpeg"); if (up.error || !up.data) throw up.error ?? new Error(t("sv.proof_fail")); path = up.data; }
      const r = await submitInspectionPayment(supabase(), i.id, { method, reference, proofPath: path }); if (r.error) throw r.error;
      onDone(t("sv.in_paid_sent"));
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <View style={[ui.card, { gap: 10 }]}>
    <Text style={ui.label}>{t("sv.pay_step1", { v: formatPrice(i.fee_amount) })}</Text>
    <PaymentDetails s={settings} />
    <Text style={ui.muted}>{t("sv.pay_desc", { ref: inspectionRef(i.ref_no) })}</Text>
    <Text style={ui.label}>{t("sv.pay_step2")}</Text>
    <Chips options={(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(k => ({ value: k, label: tc(PLAN_METHOD_LABELS[k]) }))} value={method} onChange={setMethod} />
    <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder={t("sv.pay_ref_ph")} accessibilityLabel={t("sv.pay_ref_a11y")} {...ph} />
    {proof ? <View style={{ gap: 6 }}><Image source={{ uri: proof.uri }} style={{ width: 110, height: 110, borderRadius: 10 }} accessibilityLabel={t("sv.proof")} /><Button title={t("sv.proof_remove")} variant="secondary" onPress={() => setProof(null)} /></View>
      : <View style={ui.row}><Button title={t("sv.proof_photo")} variant="secondary" onPress={() => void pick(true)} /><Button title={t("sv.gallery")} variant="secondary" onPress={() => void pick(false)} /></View>}
    <Message error={error} />
    <Button title={busy ? t("sv.sending") : t("sv.paid_btn")} disabled={busy} onPress={() => void send()} />
  </View>;
}

export function AdminInspections() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const [status, setStatus] = useState<InspectionStatus | "all">("payment_submitted"); const [items, setItems] = useState<AdminInspection[]>([]); const [s, setS] = useState<PlatformSettings | null>(null);
  const [open, setOpen] = useState<string | null>(null); const [note, setNote] = useState(""); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const [a, b] = await Promise.all([listInspectionsForAdmin(supabase(), status === "all" ? "" : status), getPlatformSettings(supabase())]);
    if (a.error) setError(friendlyErrorIn(a.error, lang)); setItems(a.data); setS(b.data);
  }
  useEffect(() => { void load(); }, [status]);
  const done = (m: string) => { setNotice(m); setError(""); setOpen(null); setNote(""); void load(); };
  async function saveMonths() {
    const m = Number(s?.inspection_valid_months), f1 = Number(s?.inspection_fee_provider_kz), f2 = Number(s?.inspection_fee_kz);
    if (!Number.isInteger(m) || m < 1 || m > 60) { setError(t("sv.ina_bad_months")); return; }
    if (!(f1 >= 0) || !(f2 >= 0)) { setError(t("sv.ina_bad_fees")); return; }
    const r = await updatePlatformSettings(supabase(), { inspection_valid_months: m, inspection_fee_provider_kz: f1, inspection_fee_kz: f2 }); if (r.error) setError(friendlyErrorIn(r.error, lang)); else done(t("sv.ina_rule_saved"));
  }
  return <View style={{ gap: 12 }}>
    <Text style={ui.h2}>{t("sv.ina_title")}</Text>
    <Text style={ui.muted}>{t("sv.ina_hint")}</Text>
    <Message error={error} ok={notice} />
    {!!s && <View style={ui.card}>
      <Field label={t("sv.ina_fee_pro")} value={String(s.inspection_fee_provider_kz ?? "")} onChangeText={v => setS({ ...s, inspection_fee_provider_kz: v })} keyboardType="numeric" />
      <Field label={t("sv.ina_fee_biz")} value={String(s.inspection_fee_kz ?? "")} onChangeText={v => setS({ ...s, inspection_fee_kz: v })} keyboardType="numeric" />
      <Field label={t("sv.ina_months")} value={String(s.inspection_valid_months ?? "")} onChangeText={v => setS({ ...s, inspection_valid_months: Number(v) || 0 })} keyboardType="numeric" />
      <Button title={t("common.save")} onPress={() => void saveMonths()} /></View>}
    <Chips options={[{ value: "payment_submitted" as const, label: t("sv.ina_f_pay") }, { value: "requested" as const, label: t("sv.ina_f_paid") }, { value: "scheduled" as const, label: t("sv.ina_f_sched") }, { value: "approved" as const, label: t("sv.ina_f_ok") }, { value: "rejected" as const, label: t("sv.ina_f_rej") }, { value: "all" as const, label: t("sv.f_all") }]}
      value={status} onChange={v => setStatus(v as InspectionStatus | "all")} />
    {items.length === 0 && <Text style={ui.text}>{t("sv.nothing_in_list")}</Text>}
    {items.map(i => <View key={i.id} style={ui.card}>
      <Text style={ui.label}>{tc(INSPECTION_KIND_LABELS[i.kind])}{i.category_slug === "fabricas" ? t("sv.ina_factory") : ""} · {i.target_name ?? "—"}</Text>
      <Text style={ui.muted}>{inspectionRef(i.ref_no)} · {tc(INSPECTION_STATUS_LABELS[i.status])}{t("sv.ina_owner", { name: i.owner_name })}{i.phone ? " · 📞 " + i.phone : ""}</Text>
      {i.fee_amount > 0 && <Text style={ui.muted}>{t("sv.ina_fee_line", { v: formatPrice(i.fee_amount) })}{i.pay_reference ? t("sv.ina_ref", { ref: i.pay_reference }) : ""}{i.paid_at ? t("sv.ina_paid") : ""}</Text>}
      {!!i.address && <Text style={ui.text}>📍 {i.address}</Text>}
      {!!i.preferred_time && <Text style={ui.muted}>{t("sv.ina_pref", { v: i.preferred_time })}</Text>}
      {!!i.note && <Text style={ui.muted}>{t("sv.note_x", { note: i.note })}</Text>}
      {!!i.scheduled_for && <Text style={ui.text}>{t("sv.ina_visit", { v: tc(scheduledText(i.scheduled_for)) })}{i.inspector_name ? " · " + i.inspector_name : ""}</Text>}
      {!!i.admin_note && <Text style={ui.muted}>{t("sv.admin_note", { note: i.admin_note })}</Text>}
      <Button title={t("sv.view_eye")} variant="secondary" onPress={() => router.push((i.kind === "provider" ? "/profissionais/" : i.kind === "business" ? "/empresas/" : "/vendedor/") + i.target_id as any)} />
      {!!i.pay_proof_path && <Button title={t("sv.proof_doc")} variant="secondary" onPress={async () => { const r = await paymentProofUrl(supabase(), i.pay_proof_path!); if (r.data) void Linking.openURL(r.data); }} />}
      {i.status === "payment_submitted" && <>
        <Button title={t("sv.ina_got_fee")} onPress={() => Alert.alert(t("sv.ina_confirm_pay"), t("sv.ina_received_q", { v: formatPrice(i.fee_amount) }), [{ text: t("sv.no"), style: "cancel" }, { text: t("sv.yes"), onPress: async () => {
          const r = await decideInspectionPayment(supabase(), i.id, true); if (r.error) setError(friendlyErrorIn(r.error, lang)); else done(t("sv.ina_fee_ok")); } }])} />
        {open === "p" + i.id ? <><TextInput style={[ui.input, ui.area]} multiline value={note} onChangeText={setNote} placeholder={t("sv.reason_owner_ph")} accessibilityLabel={t("sv.reason_plain")} {...ph} />
          <Button title={t("sv.ina_not_received")} variant="danger" onPress={async () => { const r = await decideInspectionPayment(supabase(), i.id, false, note); if (r.error) setError(friendlyErrorIn(r.error, lang)); else done(t("sv.ina_pay_rejected")); }} /></>
          : <Button title={t("sv.ina_not_received")} variant="secondary" onPress={() => { setOpen("p" + i.id); setNote(""); }} />}
      </>}
      {(i.status === "requested" || i.status === "scheduled") && <>
        <Button title={t("sv.ina_schedule")} variant="secondary" onPress={() => setOpen(open === "s" + i.id ? null : "s" + i.id)} />
        <Button title={t("sv.ina_result")} onPress={() => setOpen(open === "d" + i.id ? null : "d" + i.id)} />
      </>}
      {i.status === "approved" && (open === "r" + i.id ? <><TextInput style={[ui.input, ui.area]} multiline value={note} onChangeText={setNote} placeholder={t("sv.reason_owner_ph")} accessibilityLabel={t("sv.reason_plain")} {...ph} />
        <Button title={t("sv.ina_revoke")} variant="danger" onPress={async () => { const r = await revokeInspection(supabase(), i.id, note); if (r.error) setError(friendlyErrorIn(r.error, lang)); else done(t("sv.ina_revoked")); }} /></>
        : <Button title={t("sv.ina_revoke")} variant="secondary" onPress={() => { setOpen("r" + i.id); setNote(""); }} />)}
      {open === "s" + i.id && <ScheduleForm i={i} onDone={done} onError={setError} />}
      {open === "d" + i.id && <DecideForm i={i} onDone={done} onError={setError} />}
    </View>)}
  </View>;
}
function ScheduleForm({ i, onDone, onError }: { i: AdminInspection; onDone: (m: string) => void; onError: (m: string) => void }) {
  const { t, lang } = useT();
  const [day, setDay] = useState(""); const [hour, setHour] = useState("09:00"); const [who, setWho] = useState(i.inspector_name ?? ""); const [note, setNote] = useState("");
  async function send() {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(day.trim()); const h = /^(\d{1,2}):(\d{2})$/.exec(hour.trim());
    if (!m || !h) { onError(t("sv.ina_bad_date")); return; }
    const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}T${h[1].padStart(2, "0")}:${h[2]}:00+01:00`;
    const r = await scheduleInspection(supabase(), i.id, iso, who, note); if (r.error) onError(friendlyErrorIn(r.error, lang)); else onDone(t("sv.ina_scheduled"));
  }
  return <View style={{ gap: 8 }}>
    <Field label={t("sv.ina_day")} value={day} onChangeText={setDay} keyboardType="numbers-and-punctuation" placeholder="20/10/2026" />
    <Field label={t("sv.ina_hour")} value={hour} onChangeText={setHour} keyboardType="numbers-and-punctuation" />
    <Field label={t("sv.ina_who")} value={who} onChangeText={setWho} maxLength={80} />
    <Field label={t("sv.ina_owner_note")} value={note} onChangeText={setNote} maxLength={500} />
    <Button title={t("sv.ina_schedule_btn")} onPress={() => void send()} />
  </View>;
}
function DecideForm({ i, onDone, onError }: { i: AdminInspection; onDone: (m: string) => void; onError: (m: string) => void }) {
  const { t, tc, lang } = useT();
  const [check, setCheck] = useState<Record<string, boolean>>({}); const [note, setNote] = useState("");
  async function decide(ok: boolean) { const r = await decideInspection(supabase(), i.id, ok, check, note); if (r.error) onError(friendlyErrorIn(r.error, lang)); else onDone(ok ? t("sv.ina_approved") : t("sv.ina_rejected")); }
  return <View style={{ gap: 8 }}>
    <Text style={ui.label}>{t("sv.ina_checked")}</Text>
    {INSPECTION_CHECKLIST.map(c => <Pressable key={c.key} accessibilityRole="checkbox" accessibilityState={{ checked: !!check[c.key] }} onPress={() => setCheck({ ...check, [c.key]: !check[c.key] })}
      style={{ flexDirection: "row", gap: 10, alignItems: "center", minHeight: 48 }}>
      <Text style={{ fontSize: 24, color: C.ink }}>{check[c.key] ? "☑" : "☐"}</Text><Text style={[ui.text, { flex: 1 }]}>{tc(c.label)}{c.required ? t("sv.required") : ""}</Text></Pressable>)}
    <Field label={t("sv.ina_note_req")} value={note} onChangeText={setNote} maxLength={500} />
    <Button title={t("sv.ina_approve")} onPress={() => !check.exists ? onError(t("sv.ina_must_exist")) : Alert.alert(t("sv.ina_give_q"), t("sv.ina_give_text", { name: i.target_name ?? "" }), [{ text: t("sv.no"), style: "cancel" }, { text: t("sv.yes"), onPress: () => void decide(true) }])} />
    <Button title={t("sv.decline_x")} variant="secondary" onPress={() => void decide(false)} />
  </View>;
}
