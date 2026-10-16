import { useEffect, useState } from "react";
import { Link } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Linking, Share, Text, TextInput, View } from "react-native";
import { listCommissionsForAdmin, updateCommissionAsAdmin, COMMISSION_STATUS_LABELS, type AdminCommission,
  paymentAccounts, hasPaymentDetails, validatePaymentAccounts, MAX_PAYMENT_ACCOUNTS, type PaymentAccount,
  listRevenue, revenueSummary, revenueCsv, monthRange, REVENUE_KIND_LABELS, type RevenueRow, type RevenueKind,
  getPlatformSettings, updatePlatformSettings, listMyPlans, listPlanPaymentsForAdmin, decidePlanPayment, paymentProofUrl, submitPlanPayment, uploadPaymentProof,
  validatePlanPayment, planSummary, planTotal, needsPayment, base64ToArrayBuffer, formatPrice, friendlyErrorIn,
  PLAN_KIND_LABELS, PLAN_STATE_LABELS, PLAN_METHOD_LABELS, PLAN_MONTH_OPTIONS,
  type PlatformSettings, type AdminPlanPayment, type MyPlan, type PaymentMethodPlan } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { AdminBoosts } from "./Boosts";
import { shrinkAsset } from "../lib/image";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { useT, formatDateTimeIn, formatDayIn } from "../lib/i18n";

export function PaymentDetails({ s }: { s: PlatformSettings | null }) {
  const { t } = useT();
  if (!s || !hasPaymentDetails(s)) return <Text style={ui.muted}>{t("sh.no_payment_details")}</Text>;
  const accounts = paymentAccounts(s);
  return <View style={{ gap: 8 }}>
    {accounts.length > 1 && <Text style={ui.text}>{t("sh.any_account")}</Text>}
    {accounts.map((a, i) => <View key={i} style={[ui.card, { gap: 2 }]}>
      <Text style={ui.label}>{a.bank}</Text>
      <Text style={ui.text} selectable>IBAN: <Text style={ui.label}>{a.iban}</Text></Text>
      <Text style={ui.text}>{t("sh.holder", { name: a.holder })}</Text>
    </View>)}
    {!!s.express_number && <Text style={ui.text} selectable>Multicaixa Express: <Text style={ui.label}>{s.express_number}</Text></Text>}
    {!!s.payment_note && <Text style={ui.muted}>{s.payment_note}</Text>}
    <Text style={ui.muted}>{t("sh.hold_to_copy")}</Text>
  </View>;
}

export function PayForm({ plan, uid, settings, onDone }: { plan: MyPlan; uid: string; settings: PlatformSettings | null; onDone: (msg: string) => void }) {
  const { t, tc, lang } = useT();
  const [months, setMonths] = useState("1"); const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express");
  const [reference, setReference] = useState(""); const [proof, setProof] = useState<{ uri: string; base64?: string | null; mimeType: string } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function pick(camera: boolean) {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError(camera ? t("sh.allow_camera") : t("sh.allow_gallery")); return; }
    const r = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!r.canceled && r.assets?.[0]) setProof(await shrinkAsset(r.assets[0]));
  }
  async function send() {
    const m = Number(months);
    const invalid = validatePlanPayment({ months: m, method, reference, proofPath: proof ? "x" : null }); if (invalid) { setError(tc(invalid)); return; }
    setBusy(true); setError("");
    try {
      let path: string | null = null;
      if (proof) {
        const body = proof.base64 ? base64ToArrayBuffer(proof.base64) : await (await fetch(proof.uri)).arrayBuffer();
        const up = await uploadPaymentProof(supabase(), uid, body, "comprovativo.jpg", proof.mimeType || "image/jpeg");
        if (up.error || !up.data) throw up.error ?? new Error(t("sh.proof_upload_failed")); path = up.data;
      }
      const r = await submitPlanPayment(supabase(), plan.id, { months: m, method, reference, proofPath: path });
      if (r.error) throw r.error;
      onDone(t("sh.plan_payment_sent"));
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <View style={{ gap: 10 }}>
    <Text style={ui.label}>{t("sh.how_many_months")}</Text>
    <Chips options={PLAN_MONTH_OPTIONS.map(m => ({ value: String(m), label: t(m === 1 ? "sh.month_one" : "sh.months", { n: m }) }))} value={months} onChange={setMonths} />
    <Text style={ui.h2}>{t("sh.total", { price: formatPrice(planTotal(plan.monthly_price, Number(months))) })}</Text>
    <Text style={ui.label}>{"2. " + t("sh.pay_to_these")}</Text>
    <PaymentDetails s={settings} />
    <Text style={ui.label}>{"3. " + t("sh.tell_how_paid")}</Text>
    <Chips options={(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(k => ({ value: k, label: tc(PLAN_METHOD_LABELS[k]) }))} value={method} onChange={setMethod} />
    <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder={t("sh.ref_ph")} placeholderTextColor={C.muted} accessibilityLabel={t("sh.ref_a11y")} />
    {proof ? <View style={{ gap: 6 }}><Image source={{ uri: proof.uri }} style={{ width: 120, height: 120, borderRadius: 10 }} /><Button title={t("sh.remove_proof")} variant="secondary" onPress={() => setProof(null)} /></View>
      : <View style={ui.row}><Button title={t("sh.photo_proof")} variant="secondary" onPress={() => void pick(true)} /><Button title={t("sh.gallery")} variant="secondary" onPress={() => void pick(false)} /></View>}
    <Text style={ui.muted}>{t("sh.proof_private")}</Text>
    <Message error={error} />
    <Button title={busy ? t("sh.sending") : t("sh.send_payment_of", { price: formatPrice(planTotal(plan.monthly_price, Number(months))) })} disabled={busy} onPress={() => void send()} />
  </View>;
}

export function PlanBanner({ kind, subjectId }: { kind: "provider" | "business" | "store"; subjectId: string }) {
  const { t, tc } = useT();
  const [plan, setPlan] = useState<MyPlan | null>(null);
  useEffect(() => { void listMyPlans(supabase()).then(r => setPlan(r.data.find(p => p.kind === kind && p.subject_id === subjectId) ?? null)); }, [kind, subjectId]);
  if (!plan) return null;
  return <View style={{ gap: 4 }}>
    <Text style={plan.state === "expired" ? ui.error : ui.text}>💳 {tc(PLAN_STATE_LABELS[plan.state])} — {tc(planSummary(plan))}</Text>
    <Link href={"/conta/plano" as any} style={ui.link}>{needsPayment(plan) ? t("sh.pay_now_link") : t("sh.view_plan_link")}</Link>
  </View>;
}

export function AdminPlans() {
  const { t, tc, lang } = useT();
  const [s, setS] = useState<PlatformSettings | null>(null); const [items, setItems] = useState<AdminPlanPayment[]>([]); const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [status, setStatus] = useState<"pending" | "confirmed" | "rejected">("pending");
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [reject, setReject] = useState<string | null>(null); const [note, setNote] = useState("");
  async function load() {
    const [a, b] = await Promise.all([getPlatformSettings(supabase()), listPlanPaymentsForAdmin(supabase(), status)]);
    setS(a.data); setAccounts(paymentAccounts(a.data)); if (b.error) setError(friendlyErrorIn(b.error, lang)); setItems(b.data);
  }
  useEffect(() => { void load(); }, [status]);
  async function decide(p: AdminPlanPayment, ok: boolean) {
    if (!ok && !note.trim()) { setError(t("sh.write_why_not")); return; }
    const r = await decidePlanPayment(supabase(), p.id, ok, note);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(ok ? t("sh.plan_payment_confirmed") : t("sh.payment_rejected")); setReject(null); setNote(""); await load(); }
  }
  async function save() {
    if (!s) return;
    const num = (v: unknown) => Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
    const provider = num(s.provider_monthly_kz), business = num(s.business_monthly_kz), store = num(s.store_monthly_kz), days = Number(s.trial_days), pct = num(s.listing_commission_pct), due = Number(s.commission_due_days), boostPrice = num(s.boost_price_kz ?? 500), boostDays = Number(s.boost_days ?? 7), refDays = Number(s.referral_reward_days ?? 30);
    if (!(provider >= 0) || !(business >= 0) || !(store >= 0) || !Number.isInteger(days) || days < 0 || days > 365 || !(pct >= 0 && pct <= 50) || !Number.isInteger(due) || due < 1 || due > 90 || !(boostPrice >= 0) || !Number.isInteger(boostDays) || boostDays < 1 || boostDays > 60 || !Number.isInteger(refDays) || refDays < 0 || refDays > 365) { setError(t("sh.check_prices")); return; }
    const bad = validatePaymentAccounts(accounts); if (bad) { setError(tc(bad)); return; }
    const clean = accounts.map(a => ({ bank: a.bank.trim(), iban: a.iban.trim(), holder: a.holder.trim() }));
    const r = await updatePlatformSettings(supabase(), { provider_monthly_kz: provider, business_monthly_kz: business, store_monthly_kz: store, trial_days: days, listing_commission_pct: pct, commission_due_days: due, boost_price_kz: boostPrice, boost_days: boostDays, referral_reward_days: refDays,
      payment_accounts: clean, bank_name: clean[0]?.bank ?? null, iban: clean[0]?.iban ?? null, account_holder: clean[0]?.holder ?? null,
      express_number: s.express_number?.trim() || null, payment_note: s.payment_note?.trim() || null });
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setNotice(t("sh.data_saved"));
  }
  const field = (k: keyof PlatformSettings, label: string, numeric = false) => s && <View style={{ gap: 4 }} key={k}>
    <Text style={ui.label}>{label}</Text>
    <TextInput style={ui.input} keyboardType={numeric ? "number-pad" : "default"} value={String(s[k] ?? "")} onChangeText={v => setS({ ...s, [k]: v } as PlatformSettings)} accessibilityLabel={label} />
  </View>;
  return <View style={{ gap: 12 }}>
    <Message error={error} ok={notice} />
    <Text style={ui.h2}>{t("sh.plan_payments")}</Text>
    <Chips options={[{ value: "pending" as const, label: t("sh.to_confirm") }, { value: "confirmed" as const, label: t("sh.confirmed") }, { value: "rejected" as const, label: t("sh.rejected") }]} value={status} onChange={setStatus} />
    {items.length === 0 && <Text style={ui.text}>{t("sh.no_payments")}</Text>}
    {items.map(p => <View key={p.id} style={ui.card}>
      <Text style={ui.h2}>{formatPrice(p.amount)} · {t(p.months === 1 ? "sh.month_one" : "sh.months", { n: p.months })}</Text>
      <Text style={ui.text}>{tc(PLAN_KIND_LABELS[p.kind])}: {p.subject_name} · {p.owner_name}{p.phone ? " · " + p.phone : ""}</Text>
      <Text style={ui.muted}>{tc(PLAN_METHOD_LABELS[p.method])}{p.reference ? " · " + t("sh.ref", { ref: p.reference }) : ""} · {formatDateTimeIn(p.created_at, lang)}</Text>
      {!!p.admin_note && <Text style={ui.text}>{t("sh.note", { text: p.admin_note })}</Text>}
      {!!p.proof_path && <Button title={t("sh.view_proof")} variant="secondary" onPress={async () => { const r = await paymentProofUrl(supabase(), p.proof_path!); if (r.data) void Linking.openURL(r.data); else setError(friendlyErrorIn(r.error, lang)); }} />}
      {p.status === "pending" && (reject === p.id ? <>
        <TextInput style={[ui.input, ui.area]} multiline value={note} onChangeText={setNote} placeholder={t("sh.why_not_confirm_person")} placeholderTextColor={C.muted} accessibilityLabel={t("sh.reason")} />
        <Button title={t("sh.reject_payment")} variant="danger" onPress={() => void decide(p, false)} />
        <Button title={t("common.back")} variant="secondary" onPress={() => setReject(null)} />
      </> : <>
        <Button title={"✔ " + t("sh.confirm_payment")} onPress={() => Alert.alert(t("sh.confirm_payment"), t("sh.amount_from_q", { price: formatPrice(p.amount), name: p.owner_name }), [{ text: t("sh.no") }, { text: t("common.confirm"), onPress: () => void decide(p, true) }])} />
        <Button title={t("sh.reject")} variant="secondary" onPress={() => { setReject(p.id); setNote(""); }} />
      </>)}
    </View>)}
    <AdminCommissions />
    <AdminBoosts />
    {s && <View style={ui.card}>
      <Text style={ui.h2}>{t("sh.prices_payment_data")}</Text>
      {field("provider_monthly_kz", t("sh.f_provider"), true)}
      {field("business_monthly_kz", t("sh.f_business"), true)}
      {field("store_monthly_kz", t("sh.f_store"), true)}
      {field("listing_commission_pct", t("sh.f_commission"), true)}
      {field("commission_due_days", t("sh.f_due_days"), true)}
      {field("boost_price_kz", t("sh.f_boost_price"), true)}
      {field("boost_days", t("sh.f_boost_days"), true)}
      {field("referral_reward_days", t("sh.f_referral"), true)}
      {field("trial_days", t("sh.f_trial"), true)}
      <Text style={ui.label}>{t("sh.accounts_n", { n: accounts.length, max: MAX_PAYMENT_ACCOUNTS })}</Text>
      {accounts.map((a, i) => <View key={i} style={[ui.card, { gap: 6 }]}>
        <Text style={ui.label}>{t("sh.account_n", { n: i + 1 })}</Text>
        <TextInput style={ui.input} value={a.bank} onChangeText={v => setAccounts(accounts.map((x, j) => j === i ? { ...x, bank: v } : x))} placeholder={t("sh.bank")} placeholderTextColor={C.muted} accessibilityLabel={t("sh.bank_of", { n: i + 1 })} />
        <TextInput style={ui.input} value={a.iban} onChangeText={v => setAccounts(accounts.map((x, j) => j === i ? { ...x, iban: v } : x))} placeholder="IBAN" placeholderTextColor={C.muted} accessibilityLabel={t("sh.iban_of", { n: i + 1 })} />
        <TextInput style={ui.input} value={a.holder} onChangeText={v => setAccounts(accounts.map((x, j) => j === i ? { ...x, holder: v } : x))} placeholder={t("sh.holder_short")} placeholderTextColor={C.muted} accessibilityLabel={t("sh.holder_of", { n: i + 1 })} />
        <Button title={t("sh.remove_account")} variant="danger" onPress={() => setAccounts(accounts.filter((_, j) => j !== i))} />
      </View>)}
      {accounts.length < MAX_PAYMENT_ACCOUNTS && <Button title={t("sh.add_account")} variant="secondary" onPress={() => setAccounts([...accounts, { bank: "", iban: "", holder: "" }])} />}
      {field("express_number", t("sh.express_number"))}{field("payment_note", t("sh.payer_note"))}
      <Button title={t("common.save")} onPress={() => void save()} />
    </View>}
  </View>;
}

function AdminCommissions() {
  const { t, tc, lang } = useT();
  const [items, setItems] = useState<AdminCommission[]>([]); const [status, setStatus] = useState<"submitted" | "overdue" | "due" | "paid">("submitted");
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [edit, setEdit] = useState<string | null>(null); const [note, setNote] = useState(""); const [amount, setAmount] = useState("");
  async function load() { const r = await listCommissionsForAdmin(supabase(), status); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void load(); }, [status]);
  async function act(c: AdminCommission, action: "confirm" | "reject" | "waive" | "adjust") {
    if ((action === "reject" || action === "waive") && !note.trim()) { setError(t("sh.write_reason")); return; }
    const value = action === "adjust" ? Number(amount.replace(/\s/g, "").replace(",", ".")) : undefined;
    if (action === "adjust" && !(value! >= 0)) { setError(t("sh.invalid_value")); return; }
    const r = await updateCommissionAsAdmin(supabase(), c.id, action, note, value);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("sh.commission_updated")); setEdit(null); setNote(""); setAmount(""); await load(); }
  }
  return <View style={{ gap: 10 }}>
    <Text style={ui.h2}>{t("sh.listing_commissions")}</Text>
    <Chips options={[{ value: "submitted" as const, label: t("sh.to_confirm") }, { value: "overdue" as const, label: t("sh.overdue") }, { value: "due" as const, label: t("sh.unpaid") }, { value: "paid" as const, label: t("sh.paid_pl") }]} value={status} onChange={setStatus} />
    <Message error={error} ok={notice} />
    {items.length === 0 && <Text style={ui.text}>{t("sh.no_commissions_admin")}</Text>}
    {items.map(c => <View key={c.id} style={ui.card}>
      <Text style={ui.h2}>{formatPrice(c.amount)} · {tc(COMMISSION_STATUS_LABELS[c.status])}</Text>
      <Text style={ui.text}>{c.listing_title} · {c.owner_name}{c.phone ? " · " + c.phone : ""}</Text>
      <Text style={ui.muted}>{t("sh.sale_x", { price: formatPrice(c.sale_amount) })}{c.listed_price != null ? " " + t("sh.listed_x", { price: formatPrice(c.listed_price) }) : ""} · {t("sh.due_on", { date: formatDayIn(Date.parse(c.due_at), lang) })}</Text>
      {!!c.reference && <Text style={ui.text}>{t("sh.ref", { ref: c.reference })}</Text>}
      {!!c.proof_path && <Button title={"📄 " + t("sh.proof")} variant="secondary" onPress={async () => { const r = await paymentProofUrl(supabase(), c.proof_path!); if (r.data) void Linking.openURL(r.data); }} />}
      {(c.status === "submitted" || c.status === "due") && (edit === c.id ? <>
        <TextInput style={ui.input} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder={t("sh.real_sale_ph")} placeholderTextColor={C.muted} accessibilityLabel={t("sh.real_sale")} />
        <TextInput style={ui.input} value={note} onChangeText={setNote} placeholder={t("sh.reason_note")} placeholderTextColor={C.muted} accessibilityLabel={t("sh.reason")} />
        {!!amount && <Button title={t("sh.fix_value")} onPress={() => void act(c, "adjust")} />}
        {c.status === "submitted" && <Button title={t("sh.not_received")} variant="secondary" onPress={() => void act(c, "reject")} />}
        <Button title={t("sh.waive_commission")} variant="secondary" onPress={() => void act(c, "waive")} />
        <Button title={t("common.back")} variant="secondary" onPress={() => setEdit(null)} />
      </> : <>
        <Button title={"✔ " + t("sh.confirm_payment")} onPress={() => Alert.alert(t("sh.confirm_payment"), t("sh.amount_from_q", { price: formatPrice(c.amount), name: c.owner_name }), [{ text: t("sh.no") }, { text: t("common.confirm"), onPress: () => void act(c, "confirm") }])} />
        <Button title={t("sh.other_actions")} variant="secondary" onPress={() => { setEdit(c.id); setNote(""); setAmount(""); }} />
      </>)}
    </View>)}
  </View>;
}

/** Administração: receitas confirmadas de um mês. */
export function AdminRevenue() {
  const { t, tc, lang } = useT();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState<RevenueRow[]>([]); const [error, setError] = useState("");
  useEffect(() => { if (!/^\d{4}-\d{2}$/.test(month)) return; const { from, to } = monthRange(month);
    void listRevenue(supabase(), from, to).then(r => { if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setError(""); setRows(r.data); } }); }, [month]);
  const shift = (d: number) => { const [y, m] = month.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1 + d, 1)); setMonth(t.toISOString().slice(0, 7)); };
  const sum = revenueSummary(rows);
  return <View style={{ gap: 10 }}>
    <Text style={ui.h2}>{"💰 " + t("sh.revenue")}</Text>
    <View style={ui.row}><Button title={t("sh.prev_month")} variant="secondary" onPress={() => shift(-1)} /><Text style={ui.label}>{month.slice(5)}/{month.slice(0, 4)}</Text><Button title={t("sh.next_month")} variant="secondary" onPress={() => shift(1)} /></View>
    <Message error={error} />
    <View style={ui.card}><Text style={ui.text}>{t("sh.month_total")}</Text><Text style={ui.price}>{formatPrice(sum.total)}</Text><Text style={ui.muted}>{t("sh.n_payments", { n: sum.count })}</Text></View>
    {(Object.keys(REVENUE_KIND_LABELS) as RevenueKind[]).map(k => <Text key={k} style={ui.text}>{tc(REVENUE_KIND_LABELS[k])}: {formatPrice(sum.byKind[k] ?? 0)}</Text>)}
    {rows.length > 0 && <Button title={t("sh.share_csv")} variant="secondary" onPress={() => void Share.share({ title: t("sh.revenue_title", { month }), message: revenueCsv(rows) })} />}
    {rows.length === 0 && <Text style={ui.text}>{t("sh.no_revenue")}</Text>}
    {rows.map((r, i) => <View key={i} style={ui.card}>
      <Text style={ui.label}>{formatPrice(r.amount)} · {tc(REVENUE_KIND_LABELS[r.kind])}</Text>
      <Text style={ui.text}>{r.description} · {r.payer_name}</Text>
      <Text style={ui.muted}>{formatDateTimeIn(r.paid_at, lang)}{r.method ? " · " + tc(PLAN_METHOD_LABELS[r.method]) : ""}{r.reference ? " · " + t("sh.ref", { ref: r.reference }) : ""}</Text>
    </View>)}
  </View>;
}
