import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { listMyCommissions, submitCommissionPayment, commissionTotals, getPlatformSettings, uploadPaymentProof, base64ToArrayBuffer, formatPrice, friendlyErrorIn,
  COMMISSION_STATUS_LABELS, COMMISSION_SOURCE_LABELS, PLAN_METHOD_LABELS, type MyCommission, type PlatformSettings, type PaymentMethodPlan } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { shrinkAsset } from "../../lib/image";
import { C, ui } from "../../lib/ui";
import { Button, Chips, Message } from "../../components/Ui";
import { PaymentDetails } from "../../components/Plans";
import { useT, formatDayIn } from "../../lib/i18n";

export default function Comissoes() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<MyCommission[]>([]); const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [sel, setSel] = useState<string[]>([]); const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express"); const [reference, setReference] = useState("");
  const [proof, setProof] = useState<{ uri: string; base64?: string | null; mimeType: string } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const [c, s] = await Promise.all([listMyCommissions(supabase()), getPlatformSettings(supabase())]);
    if (c.error) setError(friendlyErrorIn(c.error, lang)); setItems(c.data); setSettings(s.data); setSel(c.data.filter(x => x.status === "due").map(x => x.id));
  }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []));
  async function pick() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError(t("sh.allow_gallery")); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!r.canceled && r.assets?.[0]) setProof(await shrinkAsset(r.assets[0]));
  }
  async function pay() {
    if (!uid) return;
    setBusy(true); setError(""); setNotice("");
    try {
      let path: string | null = null;
      if (proof) {
        const body = proof.base64 ? base64ToArrayBuffer(proof.base64) : await (await fetch(proof.uri)).arrayBuffer();
        const up = await uploadPaymentProof(supabase(), uid, body, "comprovativo.jpg", proof.mimeType || "image/jpeg");
        if (up.error || !up.data) throw up.error ?? new Error(t("sh.proof_upload_failed")); path = up.data;
      }
      const r = await submitCommissionPayment(supabase(), sel, { method, reference, proofPath: path });
      if (r.error) throw r.error;
      setNotice(t("sh.payment_sent_admin")); setReference(""); setProof(null); await load();
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></View>;
  if (!uid) return <View style={ui.screen}><Text style={ui.h1}>{t("sh.commissions")}</Text><Button title={t("auth.login")} onPress={() => router.push("/login")} /></View>;
  const tot = commissionTotals(items);
  const selTotal = items.filter(i => sel.includes(i.id)).reduce((s, i) => s + Number(i.amount), 0);
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>{"← " + t("nav.account")}</Link>
    <Text style={ui.h1}>{t("sh.commissions_title")}</Text>
    <Text style={ui.text}>{t("sh.commissions_intro", { pct: String(settings?.listing_commission_pct ?? 5), days: settings?.commission_due_days ?? 7 })}</Text>
    <Message error={error || (tot.overdueCount ? t("sh.overdue_n", { n: tot.overdueCount }) : "")} ok={notice} />
    {items.length === 0 && <Text style={ui.text}>{t("sh.no_commissions")}</Text>}
    {items.map(c => <Pressable key={c.id} disabled={c.status !== "due"} onPress={() => setSel(sel.includes(c.id) ? sel.filter(x => x !== c.id) : [...sel, c.id])}
      accessibilityRole={c.status === "due" ? "checkbox" : undefined} accessibilityState={c.status === "due" ? { checked: sel.includes(c.id) } : undefined}
      style={[ui.card, c.status === "due" && sel.includes(c.id) ? { borderColor: C.blue, borderWidth: 2 } : null]}>
      <Text style={ui.h2}>{c.status === "due" ? (sel.includes(c.id) ? "☑ " : "☐ ") : ""}{c.listing_title}</Text>
      <Text style={ui.text}>{t("sh.sale_rate", { sale: formatPrice(c.sale_amount), pct: String(c.rate_pct), amount: formatPrice(c.amount) })}</Text>
      <Text style={ui.muted}>{tc(COMMISSION_SOURCE_LABELS[c.source])} · {t("sh.due_on", { date: formatDayIn(Date.parse(c.due_at), lang) })}</Text>
      <Text style={c.overdue ? ui.error : c.status === "paid" ? ui.ok : ui.label}>{c.overdue ? t("sh.overdue") : tc(COMMISSION_STATUS_LABELS[c.status])}</Text>
      {!!c.admin_note && <Text style={ui.muted}>{t("sh.note", { text: c.admin_note })}</Text>}
    </Pressable>)}
    {tot.dueCount > 0 && <View style={ui.card}>
      <Text style={ui.h2}>{t("sh.pay_n", { n: sel.length, price: formatPrice(selTotal) })}</Text>
      <Text style={ui.label}>{"1. " + t("sh.pay_to_these")}</Text>
      <PaymentDetails s={settings} />
      <Text style={ui.label}>{"2. " + t("sh.tell_how_paid")}</Text>
      <Chips options={(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(k => ({ value: k, label: tc(PLAN_METHOD_LABELS[k]) }))} value={method} onChange={setMethod} />
      <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder={t("sh.ref_ph")} placeholderTextColor={C.muted} accessibilityLabel={t("sh.ref_a11y")} />
      {proof ? <View style={{ gap: 6 }}><Image source={{ uri: proof.uri }} style={{ width: 110, height: 110, borderRadius: 10 }} /><Button title={t("sh.remove_proof")} variant="secondary" onPress={() => setProof(null)} /></View>
        : <Button title={t("sh.attach_proof")} variant="secondary" onPress={() => void pick()} />}
      <Button title={busy ? t("sh.sending") : t("sh.send_payment_of", { price: formatPrice(selTotal) })} disabled={busy || !sel.length} onPress={() => void pay()} />
    </View>}
  </ScrollView>;
}
