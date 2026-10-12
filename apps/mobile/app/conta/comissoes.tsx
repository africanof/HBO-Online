import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { listMyCommissions, submitCommissionPayment, commissionTotals, getPlatformSettings, uploadPaymentProof, base64ToArrayBuffer, formatPrice, friendlyError,
  COMMISSION_STATUS_LABELS, COMMISSION_SOURCE_LABELS, PLAN_METHOD_LABELS, type MyCommission, type PlatformSettings, type PaymentMethodPlan } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { shrinkAsset } from "../../lib/image";
import { C, ui } from "../../lib/ui";
import { Button, Chips, Message } from "../../components/Ui";
import { PaymentDetails } from "../../components/Plans";

export default function Comissoes() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<MyCommission[]>([]); const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [sel, setSel] = useState<string[]>([]); const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express"); const [reference, setReference] = useState("");
  const [proof, setProof] = useState<{ uri: string; base64?: string | null; mimeType: string } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const [c, s] = await Promise.all([listMyCommissions(supabase()), getPlatformSettings(supabase())]);
    if (c.error) setError(friendlyError(c.error)); setItems(c.data); setSettings(s.data); setSel(c.data.filter(x => x.status === "due").map(x => x.id));
  }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []));
  async function pick() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError("Autorize o acesso à galeria."); return; }
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
        if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar o comprovativo."); path = up.data;
      }
      const r = await submitCommissionPayment(supabase(), sel, { method, reference, proofPath: path });
      if (r.error) throw r.error;
      setNotice("Pagamento enviado. A administração vai confirmar."); setReference(""); setProof(null); await load();
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <View style={ui.screen}><Text style={ui.h1}>Comissões</Text><Button title="Entrar" onPress={() => router.push("/login")} /></View>;
  const t = commissionTotals(items);
  const selTotal = items.filter(i => sel.includes(i.id)).reduce((s, i) => s + Number(i.amount), 0);
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>← A sua conta</Link>
    <Text style={ui.h1}>💸 Comissões das vendas</Text>
    <Text style={ui.text}>Publicar anúncios é grátis. Quando vende, paga {String(settings?.listing_commission_pct ?? 5)}% do valor da venda em {settings?.commission_due_days ?? 7} dias. Com comissões em atraso não pode publicar anúncios novos.</Text>
    <Message error={error || (t.overdueCount ? `⚠️ Tem ${t.overdueCount} comissão(ões) em atraso.` : "")} ok={notice} />
    {items.length === 0 && <Text style={ui.text}>Ainda não tem comissões.</Text>}
    {items.map(c => <Pressable key={c.id} disabled={c.status !== "due"} onPress={() => setSel(sel.includes(c.id) ? sel.filter(x => x !== c.id) : [...sel, c.id])}
      accessibilityRole={c.status === "due" ? "checkbox" : undefined} accessibilityState={c.status === "due" ? { checked: sel.includes(c.id) } : undefined}
      style={[ui.card, c.status === "due" && sel.includes(c.id) ? { borderColor: C.blue, borderWidth: 2 } : null]}>
      <Text style={ui.h2}>{c.status === "due" ? (sel.includes(c.id) ? "☑ " : "☐ ") : ""}{c.listing_title}</Text>
      <Text style={ui.text}>Venda: {formatPrice(c.sale_amount)} · {String(c.rate_pct)}% = {formatPrice(c.amount)}</Text>
      <Text style={ui.muted}>{COMMISSION_SOURCE_LABELS[c.source]} · prazo {new Date(c.due_at).toLocaleDateString("pt-AO")}</Text>
      <Text style={c.overdue ? ui.error : c.status === "paid" ? ui.ok : ui.label}>{c.overdue ? "Em atraso" : COMMISSION_STATUS_LABELS[c.status]}</Text>
      {!!c.admin_note && <Text style={ui.muted}>Nota: {c.admin_note}</Text>}
    </Pressable>)}
    {t.dueCount > 0 && <View style={ui.card}>
      <Text style={ui.h2}>Pagar {sel.length}: {formatPrice(selTotal)}</Text>
      <Text style={ui.label}>1. Pague para estes dados</Text>
      <PaymentDetails s={settings} />
      <Text style={ui.label}>2. Diga-nos como pagou</Text>
      <Chips options={(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(k => ({ value: k, label: PLAN_METHOD_LABELS[k] }))} value={method} onChange={setMethod} />
      <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder="Referência ou número da operação" placeholderTextColor={C.muted} accessibilityLabel="Referência do pagamento" />
      {proof ? <View style={{ gap: 6 }}><Image source={{ uri: proof.uri }} style={{ width: 110, height: 110, borderRadius: 10 }} /><Button title="Tirar comprovativo" variant="secondary" onPress={() => setProof(null)} /></View>
        : <Button title="🖼️ Juntar comprovativo" variant="secondary" onPress={() => void pick()} />}
      <Button title={busy ? "A enviar…" : "Enviar pagamento de " + formatPrice(selTotal)} disabled={busy || !sel.length} onPress={() => void pay()} />
    </View>}
  </ScrollView>;
}
