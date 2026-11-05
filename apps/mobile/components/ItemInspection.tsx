import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Linking, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { itemInspectionBadge, requestItemInspection, getItemInspectionFees, myItemInspections, submitItemInspectionPayment, cancelItemInspection, myListingOrder,
  listItemInspectionsForAdmin, decideItemInspectionPayment, itemInspectionStep, setItemInspectionFees, itemInspectionAdminSteps, itemInspectionRef, itemInspectionCategory,
  getPlatformSettings, uploadPaymentProof, paymentProofUrl, sha256Hex, base64ToArrayBuffer, formatPrice, friendlyErrorIn, ITEM_INSPECTION_CHECKLIST, ITEM_INSPECTION_OPEN, PLAN_METHOD_LABELS,
  type ItemInspection, type ItemInspectionBadge, type ItemInspectionCategory, type ItemInspectionFees, type ItemInspectionStep, type PlatformSettings } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { shrinkAsset } from "../lib/image";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { PaymentDetails } from "./Plans";
import { useT, formatDateTimeIn } from "../lib/i18n";

const ph = { placeholderTextColor: C.muted };
const day = (iso: string, lang: string) => formatDateTimeIn(iso, lang as any).split(/[, ]+/)[0];

function Checklist({ category, checklist }: { category: ItemInspectionCategory; checklist: Record<string, boolean> }) {
  const { t } = useT();
  const keys = ITEM_INSPECTION_CHECKLIST[category].filter(k => k in checklist);
  return <>{keys.map(k => <Text key={k} style={ui.text}>{checklist[k] ? "✔" : "✖"} {t("ii.c." + k)}</Text>)}</>;
}

/** No anúncio: selo para todos; pedido de inspeção para o dono, para quem quer comprar e para quem já comprou. */
export function ListingInspection({ listingId, listingType, mine, uid }: { listingId: string; listingType: string; mine: boolean; uid: string | null }) {
  const { t, lang } = useT(); const router = useRouter();
  const category = itemInspectionCategory(listingType);
  const [badge, setBadge] = useState<ItemInspectionBadge | null>(null); const [fees, setFees] = useState<ItemInspectionFees | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null); const [open, setOpen] = useState<ItemInspection | null>(null);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [showReport, setShowReport] = useState(false);
  useEffect(() => {
    void itemInspectionBadge(supabase(), { listingId }).then(setBadge);
    void getItemInspectionFees(supabase()).then(setFees);
    if (!uid) return;
    void myItemInspections(supabase()).then(r => setOpen(r.data.find(i => i.listing_id === listingId && i.requester_id === uid && ITEM_INSPECTION_OPEN.includes(i.status)) ?? null));
    if (!mine) void myListingOrder(supabase(), listingId).then(o => setOrderId(o?.id ?? null));
  }, [listingId, uid, mine]);
  async function ask() {
    setBusy(true); setErr("");
    const r = await requestItemInspection(supabase(), mine || !orderId ? { listingId } : { orderId }); // sem encomenda: inspeção antes de comprar
    setBusy(false);
    if (r.error) setErr(friendlyErrorIn(r.error, lang)); else { setMsg(t("ii.requested")); setOpen(r.data as any); }
  }
  const fee = fees ? formatPrice(fees[category]) : "";
  const canAsk = !!uid && !open && (mine ? !badge : !!orderId);
  const visitor = !mine && !orderId && !open && !msg;
  return <View style={ui.card}>
    {badge ? <>
      <Text style={[ui.label, { color: C.green }]}>{t("ii.badge")}</Text>
      <Text style={ui.muted}>{t("ii.badge_when", { d: day(badge.inspected_at, lang), v: day(badge.valid_until, lang) })} · {itemInspectionRef(badge.ref_no)}</Text>
      <Button title={t("ii.report")} variant="secondary" onPress={() => setShowReport(v => !v)} />
      {showReport && <><Checklist category={badge.category} checklist={badge.checklist} />{!!badge.report && <Text style={ui.text}>{badge.report}</Text>}</>}
    </> : <Text style={ui.label}>{t("ii.title")}</Text>}
    {canAsk && <>
      <Text style={ui.text}>{t(mine ? "ii.seller_offer" : "ii.buyer_offer", { fee })}</Text>
      <Text style={ui.muted}>{t("ii.how." + category)}</Text>
      <Button title={t("ii.request", { fee })} variant="secondary" disabled={busy} onPress={() => void ask()} />
    </>}
    {visitor && <><Text style={ui.text}>{t("ii.visitor_offer", { fee })}</Text><Text style={ui.muted}>{t("ii.how." + category)}</Text>
      {uid ? <Button title={t("ii.request_prebuy", { fee })} variant="secondary" disabled={busy} onPress={() => void ask()} />
        : <Button title={t("ii.prebuy_login")} variant="secondary" onPress={() => router.push("/login")} />}</>}
    {(!!open || !!msg) && <Text style={ui.link} onPress={() => router.push("/inspecoes" as any)}>{msg || t("ii.s." + open!.status)} · {t("ii.see_mine")} →</Text>}
    <Message error={err} />
  </View>;
}

type Pic = { uri: string; base64?: string | null; mimeType: string };
function FeePayBox({ i, onDone }: { i: ItemInspection; onDone: () => void }) {
  const { t, tc, lang } = useT();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [method, setMethod] = useState<"multicaixa_express" | "bank_transfer">("bank_transfer"); const [reference, setReference] = useState(""); const [proof, setProof] = useState<Pic | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { void getPlatformSettings(supabase()).then(x => setSettings(x.data)); }, []);
  async function pick(camera: boolean) {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setErr(t(camera ? "sv.cam_perm" : "sv.gallery_perm")); return; }
    const r = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!r.canceled && r.assets?.[0]) setProof(await shrinkAsset(r.assets[0]));
  }
  async function pay() {
    if (!proof || reference.replace(/[^A-Za-z0-9]/g, "").length < 4) { setErr(t("im.err_proof")); return; }
    setBusy(true); setErr("");
    try {
      const uid = await currentUserId(); if (!uid) throw new Error(t("sv.sign_in_account"));
      const body = proof.base64 ? base64ToArrayBuffer(proof.base64) : await (await fetch(proof.uri)).arrayBuffer(); const hash = sha256Hex(body);
      const up = await uploadPaymentProof(supabase(), uid, body, "comprovativo.jpg", proof.mimeType || "image/jpeg"); if (up.error || !up.data) throw up.error ?? new Error(t("sv.proof_fail"));
      const r = await submitItemInspectionPayment(supabase(), i.id, { method, reference, proofPath: up.data, proofHash: hash }); if (r.error) throw r.error;
      onDone();
    } catch (e) { setErr(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <View style={{ gap: 10 }}>
    <Text style={ui.label}>{t("ii.pay_step", { fee: formatPrice(i.fee) })}</Text>
    <PaymentDetails s={settings} />
    <View style={{ backgroundColor: C.yellowSoft, borderRadius: 14, padding: 12 }}><Text style={ui.label}>✍️ {t("ii.pay_desc", { ref: itemInspectionRef(i.ref_no) })}</Text></View>
    <Text style={ui.label}>{t("im.send_proof")}</Text>
    <Chips options={(["multicaixa_express", "bank_transfer"] as const).map(m => ({ value: m, label: tc(PLAN_METHOD_LABELS[m]) }))} value={method} onChange={setMethod} />
    <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder={t("sv.pay_ref_ph")} {...ph} />
    {proof ? <View style={{ gap: 6 }}><Image source={{ uri: proof.uri }} style={{ width: 110, height: 110, borderRadius: 10 }} /><Button title={t("sv.proof_change")} variant="secondary" onPress={() => setProof(null)} /></View>
      : <View style={ui.row}><Button title={t("sv.proof_photo")} variant="secondary" onPress={() => void pick(true)} /><Button title={t("sv.gallery")} variant="secondary" onPress={() => void pick(false)} /></View>}
    <Message error={err} />
    <Button title={busy ? t("sv.sending") : t("sv.fu_paid_send")} disabled={busy} onPress={() => void pay()} />
    <Text style={ui.muted}>{t("ii.fee_note")}</Text>
  </View>;
}

/** Ecrã «As minhas inspeções». */
export function MyItemInspectionsScreen() {
  const { t, lang } = useT(); const router = useRouter();
  const [items, setItems] = useState<ItemInspection[] | null>(null); const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [ok, setOk] = useState(""); const [err, setErr] = useState("");
  async function load() { const r = await myItemInspections(supabase()); if (r.error) setErr(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useFocusEffect(useCallback(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }); }, []));
  if (uid === null) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>{t("ii.see_mine")}</Text><Button title={t("auth.login")} onPress={() => router.push("/login")} /></ScrollView>;
  return <ScrollView contentContainerStyle={ui.screen}>
    <Text style={ui.h1}>🔍 {t("ii.see_mine")}</Text>
    <Message error={err} ok={ok} />
    {items && !items.length && <Text style={ui.muted}>{t("ii.none")}</Text>}
    {items?.map(i => <View key={i.id} style={ui.card}>
      <Text style={[ui.label, { fontSize: 18 }]}>{i.title}</Text>
      <Text style={ui.muted}>{itemInspectionRef(i.ref_no)} · {t("ii.cat." + i.category)} · {t(i.role === "seller" && i.mode === "buyer" ? "ii.mode.seller_of" : i.role === "seller" && i.mode === "prebuy" ? "ii.mode.seller_of_prebuy" : "ii.mode." + i.mode)} · {formatPrice(i.fee)}</Text>
      <Text style={[ui.label, { color: C.blue }]}>{t("ii.s." + i.status)}</Text>
      {!!i.scheduled_for && ["scheduled", "in_progress"].includes(i.status) && <Text style={ui.text}>{t("ii.when", { d: formatDateTimeIn(i.scheduled_for, lang) })}{i.place ? " · 📍 " + i.place : ""}</Text>}
      {!!i.team_note && <Text style={ui.muted}>{t("im.team_note")}: {i.team_note}</Text>}
      {!!i.report && <><Text style={ui.label}>{t("ii.report")}</Text><Checklist category={i.category} checklist={i.checklist} /><Text style={ui.text}>{i.report}</Text></>}
      {!!i.listing_id && <Text style={ui.link} onPress={() => router.push(("/classificados/" + i.listing_id) as any)}>{t("cg.view_listing")} →</Text>}
      {i.role === "requester" && i.status === "awaiting_payment" && <><Text style={ui.muted}>{t("ii.how." + i.category)}</Text><FeePayBox i={i} onDone={() => { setOk(t("ii.proof_sent")); void load(); }} /></>}
      {i.role === "requester" && ["awaiting_payment", "payment_submitted"].includes(i.status) && <Button title={t("ii.cancel")} variant="secondary"
        onPress={() => Alert.alert(t("ii.cancel") + "?", "", [{ text: t("sv.no"), style: "cancel" }, { text: t("ii.cancel"), style: "destructive", onPress: async () => { const r = await cancelItemInspection(supabase(), i.id); if (r.error) setErr(friendlyErrorIn(r.error, lang)); else void load(); } }])} />}
    </View>)}
  </ScrollView>;
}

/** «DD/MM/AAAA HH:MM» (hora de Angola) → ISO. */
function parseWhen(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4] - 1, +m[5]));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Equipa: taxas e pedidos de inspeção. */
export function AdminItemInspections() {
  const { t, lang } = useT();
  const [open, setOpen] = useState<"open" | "all">("open"); const [items, setItems] = useState<ItemInspection[]>([]); const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  const [fees, setFees] = useState<ItemInspectionFees | null>(null);
  async function load() { const r = await listItemInspectionsForAdmin(supabase(), open === "open"); if (r.error) setErr(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void load(); }, [open]);
  useEffect(() => { void getItemInspectionFees(supabase()).then(setFees); }, []);
  async function run(fn: () => PromiseLike<{ error: any }>) { setErr(""); setOk(""); const r = await fn(); if (r.error) setErr(friendlyErrorIn(r.error, lang)); else { setOk(t("pp.decided")); void load(); } }
  return <View style={{ gap: 12 }}>
    <Text style={ui.h2}>{t("ii.a_title")}</Text>
    {fees && <View style={ui.card}>
      <Text style={ui.label}>{t("ii.a_fees")}</Text>
      {(["item", "vehicle", "property"] as const).map(k => <View key={k} style={{ gap: 4 }}><Text style={ui.muted}>{t("ii.cat." + k)}</Text>
        <TextInput style={ui.input} keyboardType="number-pad" value={String(fees[k])} onChangeText={v => setFees({ ...fees, [k]: Number(v.replace(/\D/g, "")) || 0 })} /></View>)}
      <Button title={t("im.a_save")} variant="secondary" onPress={() => void run(() => setItemInspectionFees(supabase(), fees))} />
    </View>}
    <Chips options={[{ value: "open" as const, label: t("im.a_open") }, { value: "all" as const, label: t("im.a_all") }]} value={open} onChange={setOpen} />
    <Message error={err} ok={ok} />
    {!items.length && <Text style={ui.muted}>{t("pp.none_pending")}</Text>}
    {items.map(i => <AdminInspectionCard key={i.id} i={i} run={run} />)}
  </View>;
}

function AdminInspectionCard({ i, run }: { i: ItemInspection; run: (fn: () => PromiseLike<{ error: any }>) => Promise<void> }) {
  const { t, lang } = useT(); const router = useRouter();
  const [when, setWhen] = useState(""); const [place, setPlace] = useState(i.place ?? "");
  const [checks, setChecks] = useState<Record<string, boolean>>(i.checklist ?? {}); const [report, setReport] = useState(i.report ?? "");
  const steps = itemInspectionAdminSteps(i);
  function step(s: ItemInspectionStep) {
    if (s === "schedule") return run(() => itemInspectionStep(supabase(), i.id, s, { when: parseWhen(when), place }));
    if (s === "approve" || s === "fail") {
      const full = Object.fromEntries(ITEM_INSPECTION_CHECKLIST[i.category].map(k => [k, !!checks[k]]));
      return run(() => itemInspectionStep(supabase(), i.id, s, { checklist: full, report }));
    }
    return run(() => itemInspectionStep(supabase(), i.id, s));
  }
  return <View style={ui.card}>
    <Text style={ui.label}>{itemInspectionRef(i.ref_no)} · {i.title} · {t("ii.cat." + i.category)}</Text>
    <Text style={ui.muted}>{t("ii.mode." + i.mode)} · {i.requester_name ?? "—"} → {i.seller_name ?? "—"} · {formatPrice(i.fee)} · {formatDateTimeIn(i.updated_at, lang)}</Text>
    {i.mode === "buyer" && <Text style={ui.muted}>{t("ii.a_buyer_mode")}</Text>}
    {i.mode === "prebuy" && <Text style={ui.muted}>{t("ii.a_prebuy_mode")}</Text>}
    <Text style={[ui.label, { color: C.blue }]}>{t("ii.s." + i.status)}</Text>
    {!!i.note && <Text style={ui.text}>💬 {i.note}</Text>}
    {!!i.listing_id && <Text style={ui.link} onPress={() => router.push(("/classificados/" + i.listing_id) as any)}>{t("cg.view_listing")} →</Text>}
    {i.status === "payment_submitted" && <>
      <Text style={ui.text}>{t("sv.reference")}: <Text style={ui.label}>{i.pay_reference}</Text></Text>
      {!!i.pay_proof_path && <Button title={"🧾 " + t("im.a_proof")} variant="secondary" onPress={async () => { const u = await paymentProofUrl(supabase(), i.pay_proof_path!); if (u.data) void Linking.openURL(u.data); }} />}
      <Button title={t("pp.confirm_pay")} onPress={() => void run(() => decideItemInspectionPayment(supabase(), i.id, true))} />
      <Button title={t("pp.reject_pay")} variant="danger" onPress={() => Alert.prompt ? Alert.prompt(t("pp.reject_why"), "", w => { if (w?.trim()) void run(() => decideItemInspectionPayment(supabase(), i.id, false, w)); })
        : void run(() => decideItemInspectionPayment(supabase(), i.id, false, "Comprovativo não confirmado"))} />
    </>}
    {steps.includes("schedule") && <>
      <Text style={ui.muted}>{t("ii.a_when")} (DD/MM/AAAA HH:MM)</Text>
      <TextInput style={ui.input} value={when} onChangeText={setWhen} placeholder="15/11/2026 10:00" {...ph} />
      <Text style={ui.muted}>{t("ii.a_place")}</Text>
      <TextInput style={ui.input} value={place} onChangeText={setPlace} maxLength={300} />
    </>}
    {steps.includes("approve") && <>
      {ITEM_INSPECTION_CHECKLIST[i.category].map(k => <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Switch value={!!checks[k]} onValueChange={v => setChecks({ ...checks, [k]: v })} /><Text style={[ui.text, { flex: 1 }]}>{t("ii.c." + k)}</Text></View>)}
      <Text style={ui.muted}>{t("ii.a_report")}</Text>
      <TextInput style={[ui.input, ui.area]} value={report} onChangeText={setReport} multiline maxLength={2000} />
    </>}
    {steps.map(s => <Button key={s} title={t("ii.step." + s)} variant={s === "fail" ? "danger" : s === "schedule" || s === "start" ? "secondary" : "primary"} onPress={() => void step(s)} />)}
  </View>;
}
