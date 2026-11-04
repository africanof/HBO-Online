import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Linking, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { listImportCatalog, saveImportCatalogItem, createImportRequest, myImportRequests, acceptImportQuote, cancelImportRequest, submitImportPayment,
  listImportRequestsForAdmin, submitImportResearchPayment, getImportResearchSettings, setImportResearchSettings, decideImportResearch, quoteImport, declineImport, decideImportPayment, advanceImport, suggestedImportFee, importRef, getPlatformSettings,
  uploadPaymentProof, uploadClassifiedMedia, paymentProofUrl, sha256Hex, base64ToArrayBuffer, formatPrice, friendlyErrorIn, IMPORT_ORIGINS, IMPORT_NEXT, PLAN_METHOD_LABELS,
  type ImportCatalogItem, type ImportRequest, type ImportResearchSettings, type ImportOrigin, type ImportStatus, type PlatformSettings } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { shrinkAsset } from "../lib/image";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { PaymentDetails } from "./Plans";
import { useT, formatDateTimeIn } from "../lib/i18n";

const ph = { placeholderTextColor: C.muted };
type Pic = { uri: string; base64?: string | null; mimeType: string };
async function pick(camera: boolean, onError: (m: string) => void, msgs: { camera: string; gallery: string }): Promise<Pic | null> {
  const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) { onError(camera ? msgs.camera : msgs.gallery); return null; }
  const r = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
  return !r.canceled && r.assets?.[0] ? await shrinkAsset(r.assets[0]) : null;
}
async function bytes(p: Pic) { return p.base64 ? base64ToArrayBuffer(p.base64) : await (await fetch(p.uri)).arrayBuffer(); }

function PicField({ value, onChange, onError }: { value: Pic | null; onChange: (p: Pic | null) => void; onError: (m: string) => void }) {
  const { t } = useT();
  const msgs = { camera: t("sv.cam_perm"), gallery: t("sv.gallery_perm") };
  return value ? <View style={{ gap: 6 }}><Image source={{ uri: value.uri }} style={{ width: 110, height: 110, borderRadius: 10 }} /><Button title={t("sv.proof_change")} variant="secondary" onPress={() => onChange(null)} /></View>
    : <View style={ui.row}><Button title={t("sv.proof_photo")} variant="secondary" onPress={() => void pick(true, onError, msgs).then(onChange)} />
      <Button title={t("sv.gallery")} variant="secondary" onPress={() => void pick(false, onError, msgs).then(onChange)} /></View>;
}

/** Ecrã «Importação»: como funciona, catálogo, pedido e os meus pedidos. */
export function ImportsScreen() {
  const { t } = useT(); const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [catalog, setCatalog] = useState<ImportCatalogItem[]>([]);
  const [mine, setMine] = useState<ImportRequest[]>([]);
  const [research, setResearch] = useState<ImportResearchSettings | null>(null);
  const [pickItem, setPickItem] = useState<ImportCatalogItem | null>(null); const [formOpen, setFormOpen] = useState(false);
  async function loadMine(u: string) { setMine((await myImportRequests(supabase(), u)).data); }
  useEffect(() => { void listImportCatalog(supabase()).then(r => setCatalog(r.data)); void getImportResearchSettings(supabase()).then(setResearch); }, []);
  useFocusEffect(useCallback(() => { void currentUserId().then(u => { setUid(u); if (u) void loadMine(u); }); }, []));
  function ask(c: ImportCatalogItem | null) { if (!uid) { router.push("/login"); return; } setPickItem(c); setFormOpen(true); }

  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Text style={ui.h1}>{t("im.title")}</Text>
    <Text style={ui.text}>{t("im.intro")}</Text>
    <View style={ui.card}>
      <Text style={ui.h2}>{t("im.how")}</Text>
      {["im.how1", "im.how2", "im.how3", "im.how4"].map(k => <Text key={k} style={ui.text}>{t(k)}</Text>)}
      {!!research?.fee && <Text style={ui.label}>{t(research.deduct ? "im.how_fee" : "im.how_fee_nodeduct", { fee: formatPrice(research.fee) })}</Text>}
    </View>
    {formOpen && uid ? <ImportForm key={pickItem?.id ?? "free"} uid={uid} item={pickItem} onClose={() => setFormOpen(false)} onSent={() => { setFormOpen(false); void loadMine(uid); }} />
      : <Button title={"✈️ " + t("im.new")} onPress={() => ask(null)} />}
    {uid === null && <Text style={ui.muted}>{t("im.login")}</Text>}
    {mine.length > 0 && <>
      <Text style={ui.h2}>{t("im.mine")}</Text>
      {mine.map(r => <MyImport key={r.id} r={r} onChange={() => uid && void loadMine(uid)} />)}
    </>}
    <Text style={ui.h2}>{t("im.catalog")}</Text>
    {catalog.map(c => <View key={c.id} style={ui.card}>
      <Text style={[ui.label, { fontSize: 18 }]}>{c.icon} {c.title}</Text>
      {!!c.description && <Text style={ui.muted}>{c.description}</Text>}
      <Text style={ui.muted}>{t("im.o." + c.origin)} · {t("im.days", { min: c.days_min, max: c.days_max })}</Text>
      <Button title={t("im.ask_this")} variant="secondary" onPress={() => ask(c)} />
    </View>)}
  </ScrollView>;
}

function ImportForm({ uid, item, onSent, onClose }: { uid: string; item: ImportCatalogItem | null; onSent: () => void; onClose: () => void }) {
  const { t, lang } = useT();
  const [title, setTitle] = useState(""); const [details, setDetails] = useState(item ? item.title + ": " : ""); const [links, setLinks] = useState("");
  const [qty, setQty] = useState("1"); const [budget, setBudget] = useState(""); const [origin, setOrigin] = useState<ImportOrigin>(item?.origin ?? "any");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup"); const [address, setAddress] = useState(""); const [phone, setPhone] = useState("");
  const [photo, setPhoto] = useState<Pic | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function send() {
    setError(""); setBusy(true);
    try {
      let photoUrl: string | null = null;
      if (photo) { const up = await uploadClassifiedMedia(supabase(), await bytes(photo), uid, "foto.jpg", photo.mimeType || "image/jpeg"); if (up.error || !up.data) throw up.error ?? new Error("UPLOAD"); photoUrl = up.data; }
      const r = await createImportRequest(supabase(), { title, details, links, quantity: Number(qty), budget: budget.trim() ? Number(budget.replace(/\D/g, "")) : null,
        origin, fulfillment, address, phone, catalogId: item?.id ?? null, photoUrl });
      if (r.error) throw r.error;
      Alert.alert("✈️", t(r.data?.status === "research_payment" ? "im.r_sent" : "im.sent")); onSent();
    } catch (e: any) { setError(String(e?.message ?? "").startsWith("im.") ? t(e.message) : friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <View style={ui.card}>
    <Text style={ui.h2}>{item ? item.icon + " " + item.title : t("im.new")}</Text>
    <Text style={ui.label}>{t("im.f_title")}</Text>
    <TextInput style={ui.input} value={title} onChangeText={setTitle} maxLength={140} placeholder={t("im.f_title_ph")} {...ph} />
    <Text style={ui.label}>{t("im.f_details")}</Text>
    <TextInput style={[ui.input, ui.area]} value={details} onChangeText={setDetails} maxLength={2000} multiline />
    <Text style={ui.label}>{t("im.f_links")}</Text>
    <TextInput style={ui.input} value={links} onChangeText={setLinks} maxLength={1000} keyboardType="url" autoCapitalize="none" />
    <Text style={ui.label}>{t("im.f_photo")}</Text>
    <PicField value={photo} onChange={setPhoto} onError={setError} />
    <Text style={ui.label}>{t("im.f_qty")}</Text>
    <TextInput style={ui.input} value={qty} onChangeText={v => setQty(v.replace(/\D/g, ""))} keyboardType="number-pad" />
    <Text style={ui.label}>{t("im.f_budget")}</Text>
    <TextInput style={ui.input} value={budget} onChangeText={setBudget} keyboardType="number-pad" />
    <Text style={ui.label}>{t("im.f_origin")}</Text>
    <Chips options={IMPORT_ORIGINS.map(o => ({ value: o, label: t("im.o." + o) }))} value={origin} onChange={setOrigin} />
    <Text style={ui.label}>{t("im.f_receive")}</Text>
    <Chips options={[{ value: "pickup" as const, label: t("im.f_pickup") }, { value: "delivery" as const, label: t("im.f_delivery") }]} value={fulfillment} onChange={setFulfillment} />
    {fulfillment === "delivery" && <><Text style={ui.label}>{t("im.f_address")}</Text><TextInput style={ui.input} value={address} onChangeText={setAddress} maxLength={300} /></>}
    <Text style={ui.label}>{t("im.f_phone")}</Text>
    <TextInput style={ui.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" maxLength={30} />
    <Message error={error} />
    <Button title={busy ? t("common.loading") : "✈️ " + t("im.send")} disabled={busy} onPress={() => void send()} />
    <Button title={t("common.cancel")} variant="secondary" onPress={onClose} />
    <Text style={ui.muted}>{t("im.protected")}</Text>
  </View>;
}

function Quote({ r }: { r: ImportRequest }) {
  const { t, lang } = useT();
  const line = (k: string, v: number | null, big = false) => <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
    <Text style={big ? ui.label : ui.text}>{t(k)}</Text><Text style={big ? ui.price : ui.label}>{formatPrice(v ?? 0)}</Text></View>;
  return <View style={[ui.card, { gap: 4 }]}>
    {line("im.q_product", r.product_cost)}{line("im.q_shipping", r.shipping_cost)}{line("im.q_fee", r.service_fee)}
    {r.research_credit > 0 && line("im.q_credit", -r.research_credit)}{line("im.q_total", r.total, true)}
    {!!r.eta_days && <Text style={ui.muted}>⏱️ {t("im.q_eta", { n: r.eta_days })}</Text>}
    {!!r.quote_valid_until && r.status === "quoted" && <Text style={ui.muted}>📅 {t("im.q_valid", { d: formatDateTimeIn(r.quote_valid_until, lang) })}</Text>}
  </View>;
}

/** Transferência para o Huambo Online + comprovativo (taxa de pesquisa e pagamento da importação). */
function PayBox({ step, amount, until, refNo, onSubmit }: { step: string; amount: number; until: string | null; refNo: number;
  onSubmit: (i: { method: "bank_transfer" | "multicaixa_express"; reference: string; proofPath: string; proofHash: string }) => PromiseLike<{ error: any }>; }) {
  const { t, tc, lang } = useT();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [method, setMethod] = useState<"multicaixa_express" | "bank_transfer">("bank_transfer"); const [reference, setReference] = useState(""); const [proof, setProof] = useState<Pic | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { void getPlatformSettings(supabase()).then(x => setSettings(x.data)); }, []);
  async function pay() {
    if (!proof || reference.replace(/[^A-Za-z0-9]/g, "").length < 4) { setError(t("im.err_proof")); return; }
    setBusy(true); setError("");
    try {
      const uid = await currentUserId(); if (!uid) throw new Error(t("sv.sign_in_account"));
      const body = await bytes(proof); const hash = sha256Hex(body);
      const up = await uploadPaymentProof(supabase(), uid, body, "comprovativo.jpg", proof.mimeType || "image/jpeg"); if (up.error || !up.data) throw up.error ?? new Error(t("sv.proof_fail"));
      const x = await onSubmit({ method, reference, proofPath: up.data, proofHash: hash }); if (x.error) throw x.error;
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <View style={{ gap: 10 }}>
    <Text style={ui.label}>{t(step, { total: formatPrice(amount), fee: formatPrice(amount) })} {until ? t("im.pay_until", { d: formatDateTimeIn(until, lang) }) : ""}</Text>
    <PaymentDetails s={settings} />
    <View style={{ backgroundColor: C.yellowSoft, borderRadius: 14, padding: 12 }}><Text style={ui.label}>✍️ {t("im.pay_desc", { ref: importRef(refNo) })}</Text></View>
    <Text style={ui.label}>{t("im.send_proof")}</Text>
    <Chips options={(["multicaixa_express", "bank_transfer"] as const).map(m => ({ value: m, label: tc(PLAN_METHOD_LABELS[m]) }))} value={method} onChange={setMethod} />
    <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder={t("sv.pay_ref_ph")} accessibilityLabel={t("sv.pay_ref_a11y")} {...ph} />
    <PicField value={proof} onChange={setProof} onError={setError} />
    <Message error={error} />
    <Button title={busy ? t("sv.sending") : t("sv.fu_paid_send")} disabled={busy} onPress={() => void pay()} />
    <Text style={ui.muted}>{t("im.protected")}</Text>
  </View>;
}

function MyImport({ r, onChange }: { r: ImportRequest; onChange: () => void }) {
  const { t, lang } = useT();
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [ok, setOk] = useState("");
  const expired = (iso: string | null) => !!iso && new Date(iso).getTime() < Date.now();
  async function run(fn: () => PromiseLike<{ error: any }>, okMsg = "") {
    setBusy(true); setError(""); const x = await fn(); setBusy(false);
    if (x.error) setError(friendlyErrorIn(x.error, lang)); else { if (okMsg) setOk(okMsg); onChange(); }
    return x;
  }
  return <View style={ui.card}>
    <Text style={[ui.label, { fontSize: 18 }]}>{r.title}</Text>
    <Text style={ui.muted}>{importRef(r.ref_no)} · {t("im.qty_n", { n: r.quantity })} · {t("im.o." + r.origin)}</Text>
    <Text style={[ui.label, { color: C.blue }]}>{t("im.s." + r.status)}</Text>
    {!!r.tracking && <Text selectable style={ui.text}>{t("im.tracking")}: <Text style={ui.label}>{r.tracking}</Text></Text>}
    {!!r.team_note && <Text style={["declined", "refunded", "awaiting_payment", "research_payment"].includes(r.status) ? ui.error : ui.muted}>{t("im.team_note")}: {r.team_note}</Text>}
    {r.status === "refunded" && <Text style={ui.muted}>{t("im.refund_note")}</Text>}
    {r.status === "research_payment" && (expired(r.research_pay_by) ? <Text style={ui.error}>{t("im.pay_expired")}</Text>
      : <PayBox step="im.r_pay_step" amount={r.research_fee} until={r.research_pay_by} refNo={r.ref_no}
        onSubmit={i => run(() => submitImportResearchPayment(supabase(), r.id, i), t("im.r_proof_sent"))} />)}
    {r.total != null && !["research_payment", "research_submitted", "requested", "declined", "cancelled"].includes(r.status) && <Quote r={r} />}
    {!!r.quote_note && r.status === "quoted" && <Text style={ui.text}>💬 {r.quote_note}</Text>}
    {r.status === "quoted" && (expired(r.quote_valid_until) ? <Text style={ui.error}>{t("im.q_expired")}</Text>
      : <Button title={t("im.accept")} disabled={busy} onPress={() => void run(() => acceptImportQuote(supabase(), r.id))} />)}
    {r.status === "awaiting_payment" && (expired(r.pay_by) ? <>
      <Text style={ui.error}>{t("im.pay_expired")}</Text>
      {!expired(r.quote_valid_until) && <Button title={t("im.accept")} disabled={busy} onPress={() => void run(() => acceptImportQuote(supabase(), r.id))} />}
    </> : <PayBox step="im.pay_step" amount={r.total ?? 0} until={r.pay_by} refNo={r.ref_no} onSubmit={i => run(() => submitImportPayment(supabase(), r.id, i), t("im.proof_sent"))} />)}
    {["research_payment", "requested", "quoted", "awaiting_payment"].includes(r.status) && <Button title={t("im.cancel")} variant="secondary" disabled={busy}
      onPress={() => Alert.alert(t("im.cancel_q"), "", [{ text: t("sv.no"), style: "cancel" }, { text: t("im.cancel"), style: "destructive", onPress: () => void run(() => cancelImportRequest(supabase(), r.id)) }])} />}
    <Message error={error} ok={ok} />
  </View>;
}

/** Equipa: pedidos de importação e catálogo. */
export function AdminImports() {
  const { t, lang } = useT();
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [items, setItems] = useState<ImportRequest[]>([]); const [error, setError] = useState(""); const [ok, setOk] = useState("");
  async function load() { const r = await listImportRequestsForAdmin(supabase(), filter === "open" ? "open" : ""); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void load(); }, [filter]);
  async function run(fn: () => PromiseLike<{ error: any }>) { setError(""); setOk(""); const r = await fn(); if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setOk(t("pp.decided")); void load(); } }
  return <View style={{ gap: 12 }}>
    <Text style={ui.h2}>{t("im.a_title")}</Text>
    <Chips options={[{ value: "open" as const, label: t("im.a_open") }, { value: "all" as const, label: t("im.a_all") }]} value={filter} onChange={setFilter} />
    <Message error={error} ok={ok} />
    {items.length === 0 && <Text style={ui.muted}>{t("pp.none_pending")}</Text>}
    {items.map(r => <AdminImportCard key={r.id} r={r} run={run} />)}
    <AdminResearchFee />
    <AdminImportCatalog />
  </View>;
}

function Ask({ title, onDone, onClose, numeric }: { title: string; onDone: (v: string) => void; onClose: () => void; numeric?: boolean }) {
  const { t } = useT(); const [v, setV] = useState("");
  return <View style={[ui.card, { borderColor: C.blue }]}>
    <Text style={ui.label}>{title}</Text>
    <TextInput style={ui.input} value={v} onChangeText={setV} maxLength={500} keyboardType={numeric ? "number-pad" : "default"} autoFocus />
    <View style={ui.row}><Button title="OK" onPress={() => onDone(v)} /><Button title={t("common.cancel")} variant="secondary" onPress={onClose} /></View>
  </View>;
}

function AdminImportCard({ r, run }: { r: ImportRequest; run: (fn: () => PromiseLike<{ error: any }>) => Promise<void> }) {
  const { t, lang } = useT();
  const [product, setProduct] = useState(r.product_cost ? String(r.product_cost) : ""); const [shipping, setShipping] = useState(r.shipping_cost != null ? String(r.shipping_cost) : "");
  const [fee, setFee] = useState(r.service_fee != null ? String(r.service_fee) : ""); const [eta, setEta] = useState(r.eta_days ? String(r.eta_days) : "30"); const [note, setNote] = useState(r.quote_note ?? "");
  const [ask, setAsk] = useState<null | { title: string; done: (v: string) => void }>(null);
  const n = (v: string) => Number(v.replace(/\D/g, "")) || 0;
  const hint = suggestedImportFee(n(product), n(shipping));
  const canQuote = r.status === "requested" || r.status === "quoted" || r.status === "awaiting_payment";
  const num = (label: string, v: string, set: (s: string) => void) => <View style={{ flex: 1, minWidth: 130, gap: 4 }}><Text style={ui.muted}>{label}</Text>
    <TextInput style={ui.input} value={v} onChangeText={set} keyboardType="number-pad" /></View>;
  return <View style={ui.card}>
    <Text style={ui.label}>{importRef(r.ref_no)} · {r.title} · {t("im.qty_n", { n: r.quantity })}</Text>
    <Text style={ui.muted}>{r.buyer_name ?? "—"} · {t("im.o." + r.origin)} · {t(r.fulfillment === "delivery" ? "im.f_delivery" : "im.f_pickup")}{r.address ? ": " + r.address : ""}</Text>
    <Text style={ui.link} onPress={() => void Linking.openURL("tel:" + r.phone)}>📞 {r.phone}</Text>
    {!!r.details && <Text style={ui.text}>{r.details}</Text>}
    {!!r.links && <Text selectable style={ui.muted}>🔗 {r.links}</Text>}
    {!!r.photo_url && <Image source={{ uri: r.photo_url }} style={{ width: 140, height: 140, borderRadius: 12 }} />}
    {!!r.budget && <Text style={ui.muted}>{t("im.f_budget")}: {formatPrice(r.budget)}</Text>}
    <Text style={[ui.label, { color: C.blue }]}>{t("im.s." + r.status)}{r.total != null ? " · " + formatPrice(r.total) : ""} · {formatDateTimeIn(r.updated_at, lang)}</Text>
    {!!r.team_note && <Text style={ui.muted}>{t("im.team_note")}: {r.team_note}</Text>}
    {canQuote && <>
      <View style={ui.row}>{num(t("im.q_product"), product, setProduct)}{num(t("im.q_shipping"), shipping, setShipping)}</View>
      <View style={ui.row}>{num(t("im.q_fee"), fee, setFee)}{num(t("im.a_eta"), eta, setEta)}</View>
      <Text style={ui.muted}>{t("im.a_fee_hint", { fee: formatPrice(hint) })} · {t("im.q_total")}: {formatPrice(n(product) + n(shipping) + (fee.trim() ? n(fee) : hint))}</Text>
      <TextInput style={ui.input} value={note} onChangeText={setNote} maxLength={1000} placeholder={t("im.a_note")} {...ph} />
      <Button title={t(r.status === "requested" ? "im.a_quote" : "im.a_requote")}
        onPress={() => void run(() => quoteImport(supabase(), r.id, { product: n(product), shipping: n(shipping), fee: fee.trim() ? n(fee) : hint, etaDays: n(eta), note }))} />
      <Button title={t("im.a_decline")} variant="danger" onPress={() => setAsk({ title: t("im.a_decline_q"), done: v => { if (v.trim()) void run(() => declineImport(supabase(), r.id, v)); } })} />
    </>}
    {r.status === "research_submitted" && <>
      <Text style={ui.text}>{t("im.a_research")}: <Text style={ui.label}>{formatPrice(r.research_fee)}</Text> · {t("sv.reference")}: <Text style={ui.label}>{r.research_reference}</Text></Text>
      {!!r.research_proof_path && <Button title={"🧾 " + t("im.a_proof")} variant="secondary" onPress={async () => { const u = await paymentProofUrl(supabase(), r.research_proof_path!); if (u.data) void Linking.openURL(u.data); }} />}
      <Button title={t("pp.confirm_pay")} onPress={() => void run(() => decideImportResearch(supabase(), r.id, true))} />
      <Button title={t("pp.reject_pay")} variant="danger" onPress={() => setAsk({ title: t("pp.reject_why"), done: v => { if (v.trim()) void run(() => decideImportResearch(supabase(), r.id, false, v)); } })} />
    </>}
    {r.status === "research_payment" && <Button title={t("im.a_decline")} variant="danger" onPress={() => setAsk({ title: t("im.a_decline_q"), done: v => { if (v.trim()) void run(() => declineImport(supabase(), r.id, v)); } })} />}
    {r.status === "submitted" && <>
      <Text style={ui.text}>{t("sv.reference")}: <Text style={ui.label}>{r.reference}</Text></Text>
      {!!r.proof_path && <Button title={"🧾 " + t("im.a_proof")} variant="secondary" onPress={async () => { const u = await paymentProofUrl(supabase(), r.proof_path!); if (u.data) void Linking.openURL(u.data); }} />}
      <Button title={t("pp.confirm_pay")} onPress={() => void run(() => decideImportPayment(supabase(), r.id, true))} />
      <Button title={t("pp.reject_pay")} variant="danger" onPress={() => setAsk({ title: t("pp.reject_why"), done: v => { if (v.trim()) void run(() => decideImportPayment(supabase(), r.id, false, v)); } })} />
    </>}
    {(IMPORT_NEXT[r.status] ?? []).map(s => <Button key={s} title={t("im.a_mark", { s: t("im.s." + s) })} variant={s === "refunded" ? "danger" : "primary"} onPress={() => {
      if (s === "refunded") setAsk({ title: t("im.a_refund_q"), done: v => { if (v.trim()) void run(() => advanceImport(supabase(), r.id, s, v)); } });
      else if (s === "in_transit") setAsk({ title: t("im.a_tracking_q"), done: v => void run(() => advanceImport(supabase(), r.id, s, null, v)) });
      else void run(() => advanceImport(supabase(), r.id, s as ImportStatus));
    }} />)}
    {ask && <Ask title={ask.title} onClose={() => setAsk(null)} onDone={v => { setAsk(null); ask.done(v); }} />}
  </View>;
}

function AdminResearchFee() {
  const { t, lang } = useT();
  const [fee, setFee] = useState(""); const [deduct, setDeduct] = useState(true); const [ok, setOk] = useState(""); const [error, setError] = useState("");
  useEffect(() => { void getImportResearchSettings(supabase()).then(s => { setFee(String(s.fee)); setDeduct(s.deduct); }); }, []);
  async function save() {
    setOk(""); setError(""); const r = await setImportResearchSettings(supabase(), { fee: Number(fee.replace(/\D/g, "")) || 0, deduct });
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setOk(t("pp.decided"));
  }
  return <View style={ui.card}>
    <Text style={ui.label}>💡 {t("im.a_research")}</Text>
    <Text style={ui.muted}>{t("im.a_research_fee")}</Text>
    <TextInput style={ui.input} value={fee} onChangeText={setFee} keyboardType="number-pad" />
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Switch value={deduct} onValueChange={setDeduct} /><Text style={[ui.text, { flex: 1 }]}>{t("im.a_research_deduct")}</Text></View>
    <Message error={error} ok={ok} />
    <Button title={t("im.a_save")} onPress={() => void save()} />
  </View>;
}

function AdminImportCatalog() {
  const { t, lang } = useT();
  const [items, setItems] = useState<ImportCatalogItem[]>([]); const [error, setError] = useState(""); const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [icon, setIcon] = useState("📦"); const [origin, setOrigin] = useState<ImportOrigin>("any");
  async function load() { setItems((await listImportCatalog(supabase(), true)).data); }
  useEffect(() => { void load(); }, []);
  async function save(item: Partial<ImportCatalogItem> & { title: string }) {
    setError(""); const r = await saveImportCatalogItem(supabase(), item);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setTitle(""); setDescription(""); void load(); }
  }
  if (!open) return <Button title={`${t("im.a_catalog")} (${items.length})`} variant="secondary" onPress={() => setOpen(true)} />;
  return <View style={ui.card}>
    <Text style={ui.h2}>{t("im.a_catalog")}</Text>
    {items.map(c => <View key={c.id} style={{ gap: 4, opacity: c.active ? 1 : 0.5 }}>
      <Text style={ui.text}>{c.icon} {c.title} · {t("im.o." + c.origin)}</Text>
      <Button title={t(c.active ? "im.a_hide" : "im.a_show")} variant="secondary" onPress={() => void save({ ...c, active: !c.active })} />
    </View>)}
    <TextInput style={ui.input} value={icon} onChangeText={setIcon} maxLength={8} />
    <TextInput style={ui.input} value={title} onChangeText={setTitle} maxLength={120} placeholder={t("im.f_title")} {...ph} />
    <TextInput style={ui.input} value={description} onChangeText={setDescription} maxLength={1000} placeholder={t("im.f_details")} {...ph} />
    <Chips options={IMPORT_ORIGINS.map(o => ({ value: o, label: t("im.o." + o) }))} value={origin} onChange={setOrigin} />
    <Message error={error} />
    <Button title={t("im.a_add")} disabled={title.trim().length < 3} onPress={() => void save({ title, description, icon, origin })} />
  </View>;
}
