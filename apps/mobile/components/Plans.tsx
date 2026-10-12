import { useEffect, useState } from "react";
import { Link } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Linking, Share, Text, TextInput, View } from "react-native";
import { listCommissionsForAdmin, updateCommissionAsAdmin, COMMISSION_STATUS_LABELS, type AdminCommission,
  paymentAccounts, hasPaymentDetails, validatePaymentAccounts, MAX_PAYMENT_ACCOUNTS, type PaymentAccount,
  listRevenue, revenueSummary, revenueCsv, monthRange, REVENUE_KIND_LABELS, type RevenueRow, type RevenueKind,
  getPlatformSettings, updatePlatformSettings, listMyPlans, listPlanPaymentsForAdmin, decidePlanPayment, paymentProofUrl, submitPlanPayment, uploadPaymentProof,
  validatePlanPayment, planSummary, planTotal, needsPayment, base64ToArrayBuffer, formatPrice, friendlyError,
  PLAN_KIND_LABELS, PLAN_STATE_LABELS, PLAN_METHOD_LABELS, PLAN_MONTH_OPTIONS,
  type PlatformSettings, type AdminPlanPayment, type MyPlan, type PaymentMethodPlan } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { shrinkAsset } from "../lib/image";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";

export function PaymentDetails({ s }: { s: PlatformSettings | null }) {
  if (!s || !hasPaymentDetails(s)) return <Text style={ui.muted}>Os dados para pagamento ainda não foram publicados pela administração. Contacte-nos pelas mensagens.</Text>;
  const accounts = paymentAccounts(s);
  return <View style={{ gap: 8 }}>
    {accounts.length > 1 && <Text style={ui.text}>Pode pagar para qualquer uma destas contas:</Text>}
    {accounts.map((a, i) => <View key={i} style={[ui.card, { gap: 2 }]}>
      <Text style={ui.label}>{a.bank}</Text>
      <Text style={ui.text} selectable>IBAN: <Text style={ui.label}>{a.iban}</Text></Text>
      <Text style={ui.text}>Titular: {a.holder}</Text>
    </View>)}
    {!!s.express_number && <Text style={ui.text} selectable>Multicaixa Express: <Text style={ui.label}>{s.express_number}</Text></Text>}
    {!!s.payment_note && <Text style={ui.muted}>{s.payment_note}</Text>}
    <Text style={ui.muted}>Toque e mantenha o IBAN para o copiar.</Text>
  </View>;
}

export function PayForm({ plan, uid, settings, onDone }: { plan: MyPlan; uid: string; settings: PlatformSettings | null; onDone: (msg: string) => void }) {
  const [months, setMonths] = useState("1"); const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express");
  const [reference, setReference] = useState(""); const [proof, setProof] = useState<{ uri: string; base64?: string | null; mimeType: string } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function pick(camera: boolean) {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError(camera ? "Autorize a câmara." : "Autorize o acesso à galeria."); return; }
    const r = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!r.canceled && r.assets?.[0]) setProof(await shrinkAsset(r.assets[0]));
  }
  async function send() {
    const m = Number(months);
    const invalid = validatePlanPayment({ months: m, method, reference, proofPath: proof ? "x" : null }); if (invalid) { setError(invalid); return; }
    setBusy(true); setError("");
    try {
      let path: string | null = null;
      if (proof) {
        const body = proof.base64 ? base64ToArrayBuffer(proof.base64) : await (await fetch(proof.uri)).arrayBuffer();
        const up = await uploadPaymentProof(supabase(), uid, body, "comprovativo.jpg", proof.mimeType || "image/jpeg");
        if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar o comprovativo."); path = up.data;
      }
      const r = await submitPlanPayment(supabase(), plan.id, { months: m, method, reference, proofPath: path });
      if (r.error) throw r.error;
      onDone("Pagamento enviado. A administração vai confirmar e recebe uma notificação.");
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  return <View style={{ gap: 10 }}>
    <Text style={ui.label}>1. Quantos meses quer pagar?</Text>
    <Chips options={PLAN_MONTH_OPTIONS.map(m => ({ value: String(m), label: m + (m === 1 ? " mês" : " meses") }))} value={months} onChange={setMonths} />
    <Text style={ui.h2}>Total: {formatPrice(planTotal(plan.monthly_price, Number(months)))}</Text>
    <Text style={ui.label}>2. Pague para estes dados</Text>
    <PaymentDetails s={settings} />
    <Text style={ui.label}>3. Diga-nos como pagou</Text>
    <Chips options={(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(k => ({ value: k, label: PLAN_METHOD_LABELS[k] }))} value={method} onChange={setMethod} />
    <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder="Referência ou número da operação" placeholderTextColor={C.muted} accessibilityLabel="Referência do pagamento" />
    {proof ? <View style={{ gap: 6 }}><Image source={{ uri: proof.uri }} style={{ width: 120, height: 120, borderRadius: 10 }} /><Button title="Tirar comprovativo" variant="secondary" onPress={() => setProof(null)} /></View>
      : <View style={ui.row}><Button title="📷 Fotografar comprovativo" variant="secondary" onPress={() => void pick(true)} /><Button title="🖼️ Galeria" variant="secondary" onPress={() => void pick(false)} /></View>}
    <Text style={ui.muted}>🔒 O comprovativo fica privado: só a administração o vê.</Text>
    <Message error={error} />
    <Button title={busy ? "A enviar…" : "Enviar pagamento de " + formatPrice(planTotal(plan.monthly_price, Number(months)))} disabled={busy} onPress={() => void send()} />
  </View>;
}

export function PlanBanner({ kind, subjectId }: { kind: "provider" | "business" | "store"; subjectId: string }) {
  const [plan, setPlan] = useState<MyPlan | null>(null);
  useEffect(() => { void listMyPlans(supabase()).then(r => setPlan(r.data.find(p => p.kind === kind && p.subject_id === subjectId) ?? null)); }, [kind, subjectId]);
  if (!plan) return null;
  return <View style={{ gap: 4 }}>
    <Text style={plan.state === "expired" ? ui.error : ui.text}>💳 {PLAN_STATE_LABELS[plan.state]} — {planSummary(plan)}</Text>
    <Link href={"/conta/plano" as any} style={ui.link}>{needsPayment(plan) ? "Pagar agora →" : "Ver o meu plano →"}</Link>
  </View>;
}

export function AdminPlans() {
  const [s, setS] = useState<PlatformSettings | null>(null); const [items, setItems] = useState<AdminPlanPayment[]>([]); const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [status, setStatus] = useState<"pending" | "confirmed" | "rejected">("pending");
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [reject, setReject] = useState<string | null>(null); const [note, setNote] = useState("");
  async function load() {
    const [a, b] = await Promise.all([getPlatformSettings(supabase()), listPlanPaymentsForAdmin(supabase(), status)]);
    setS(a.data); setAccounts(paymentAccounts(a.data)); if (b.error) setError(friendlyError(b.error)); setItems(b.data);
  }
  useEffect(() => { void load(); }, [status]);
  async function decide(p: AdminPlanPayment, ok: boolean) {
    if (!ok && !note.trim()) { setError("Escreva porque não confirma."); return; }
    const r = await decidePlanPayment(supabase(), p.id, ok, note);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(ok ? "Pagamento confirmado. O perfil fica visível." : "Pagamento recusado."); setReject(null); setNote(""); await load(); }
  }
  async function save() {
    if (!s) return;
    const num = (v: unknown) => Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
    const provider = num(s.provider_monthly_kz), business = num(s.business_monthly_kz), store = num(s.store_monthly_kz), days = Number(s.trial_days), pct = num(s.listing_commission_pct), due = Number(s.commission_due_days);
    if (!(provider >= 0) || !(business >= 0) || !(store >= 0) || !Number.isInteger(days) || days < 0 || days > 365 || !(pct >= 0 && pct <= 50) || !Number.isInteger(due) || due < 1 || due > 90) { setError("Verifique os preços, a percentagem e os dias."); return; }
    const bad = validatePaymentAccounts(accounts); if (bad) { setError(bad); return; }
    const clean = accounts.map(a => ({ bank: a.bank.trim(), iban: a.iban.trim(), holder: a.holder.trim() }));
    const r = await updatePlatformSettings(supabase(), { provider_monthly_kz: provider, business_monthly_kz: business, store_monthly_kz: store, trial_days: days, listing_commission_pct: pct, commission_due_days: due,
      payment_accounts: clean, bank_name: clean[0]?.bank ?? null, iban: clean[0]?.iban ?? null, account_holder: clean[0]?.holder ?? null,
      express_number: s.express_number?.trim() || null, payment_note: s.payment_note?.trim() || null });
    if (r.error) setError(friendlyError(r.error)); else setNotice("Dados guardados.");
  }
  const field = (k: keyof PlatformSettings, label: string, numeric = false) => s && <View style={{ gap: 4 }} key={k}>
    <Text style={ui.label}>{label}</Text>
    <TextInput style={ui.input} keyboardType={numeric ? "number-pad" : "default"} value={String(s[k] ?? "")} onChangeText={v => setS({ ...s, [k]: v } as PlatformSettings)} accessibilityLabel={label} />
  </View>;
  return <View style={{ gap: 12 }}>
    <Message error={error} ok={notice} />
    <Text style={ui.h2}>Pagamentos de mensalidade</Text>
    <Chips options={[{ value: "pending" as const, label: "Por confirmar" }, { value: "confirmed" as const, label: "Confirmados" }, { value: "rejected" as const, label: "Recusados" }]} value={status} onChange={setStatus} />
    {items.length === 0 && <Text style={ui.text}>Sem pagamentos.</Text>}
    {items.map(p => <View key={p.id} style={ui.card}>
      <Text style={ui.h2}>{formatPrice(p.amount)} · {p.months} {p.months === 1 ? "mês" : "meses"}</Text>
      <Text style={ui.text}>{PLAN_KIND_LABELS[p.kind]}: {p.subject_name} · {p.owner_name}{p.phone ? " · " + p.phone : ""}</Text>
      <Text style={ui.muted}>{PLAN_METHOD_LABELS[p.method]}{p.reference ? " · Ref.: " + p.reference : ""} · {new Date(p.created_at).toLocaleString("pt-AO")}</Text>
      {!!p.admin_note && <Text style={ui.text}>Nota: {p.admin_note}</Text>}
      {!!p.proof_path && <Button title="📄 Ver comprovativo" variant="secondary" onPress={async () => { const r = await paymentProofUrl(supabase(), p.proof_path!); if (r.data) void Linking.openURL(r.data); else setError(friendlyError(r.error)); }} />}
      {p.status === "pending" && (reject === p.id ? <>
        <TextInput style={[ui.input, ui.area]} multiline value={note} onChangeText={setNote} placeholder="Porque não confirma? (a pessoa vai ler)" placeholderTextColor={C.muted} accessibilityLabel="Motivo" />
        <Button title="Recusar pagamento" variant="danger" onPress={() => void decide(p, false)} />
        <Button title="Voltar" variant="secondary" onPress={() => setReject(null)} />
      </> : <>
        <Button title="✔ Confirmar pagamento" onPress={() => Alert.alert("Confirmar pagamento", `${formatPrice(p.amount)} de ${p.owner_name}?`, [{ text: "Não" }, { text: "Confirmar", onPress: () => void decide(p, true) }])} />
        <Button title="✖ Recusar" variant="secondary" onPress={() => { setReject(p.id); setNote(""); }} />
      </>)}
    </View>)}
    <AdminCommissions />
    {s && <View style={ui.card}>
      <Text style={ui.h2}>Preços e dados para pagamento</Text>
      {field("provider_monthly_kz", "Mensalidade dos profissionais (Kz)", true)}
      {field("business_monthly_kz", "Mensalidade das empresas (Kz)", true)}
      {field("store_monthly_kz", "Mensalidade das Lojas (Kz)", true)}
      {field("listing_commission_pct", "Comissão dos anúncios vendidos (%)", true)}
      {field("commission_due_days", "Dias para pagar a comissão", true)}
      {field("trial_days", "Dias grátis para perfis novos", true)}
      <Text style={ui.label}>Contas para receber ({accounts.length}/{MAX_PAYMENT_ACCOUNTS})</Text>
      {accounts.map((a, i) => <View key={i} style={[ui.card, { gap: 6 }]}>
        <Text style={ui.label}>Conta {i + 1}</Text>
        <TextInput style={ui.input} value={a.bank} onChangeText={v => setAccounts(accounts.map((x, j) => j === i ? { ...x, bank: v } : x))} placeholder="Banco" placeholderTextColor={C.muted} accessibilityLabel={`Banco da conta ${i + 1}`} />
        <TextInput style={ui.input} value={a.iban} onChangeText={v => setAccounts(accounts.map((x, j) => j === i ? { ...x, iban: v } : x))} placeholder="IBAN" placeholderTextColor={C.muted} accessibilityLabel={`IBAN da conta ${i + 1}`} />
        <TextInput style={ui.input} value={a.holder} onChangeText={v => setAccounts(accounts.map((x, j) => j === i ? { ...x, holder: v } : x))} placeholder="Titular" placeholderTextColor={C.muted} accessibilityLabel={`Titular da conta ${i + 1}`} />
        <Button title="Tirar esta conta" variant="danger" onPress={() => setAccounts(accounts.filter((_, j) => j !== i))} />
      </View>)}
      {accounts.length < MAX_PAYMENT_ACCOUNTS && <Button title="➕ Juntar conta bancária" variant="secondary" onPress={() => setAccounts([...accounts, { bank: "", iban: "", holder: "" }])} />}
      {field("express_number", "Número Multicaixa Express")}{field("payment_note", "Nota para quem paga")}
      <Button title="Guardar" onPress={() => void save()} />
    </View>}
  </View>;
}

function AdminCommissions() {
  const [items, setItems] = useState<AdminCommission[]>([]); const [status, setStatus] = useState<"submitted" | "overdue" | "due" | "paid">("submitted");
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [edit, setEdit] = useState<string | null>(null); const [note, setNote] = useState(""); const [amount, setAmount] = useState("");
  async function load() { const r = await listCommissionsForAdmin(supabase(), status); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useEffect(() => { void load(); }, [status]);
  async function act(c: AdminCommission, action: "confirm" | "reject" | "waive" | "adjust") {
    if ((action === "reject" || action === "waive") && !note.trim()) { setError("Escreva o motivo."); return; }
    const value = action === "adjust" ? Number(amount.replace(/\s/g, "").replace(",", ".")) : undefined;
    if (action === "adjust" && !(value! >= 0)) { setError("Valor inválido."); return; }
    const r = await updateCommissionAsAdmin(supabase(), c.id, action, note, value);
    if (r.error) setError(friendlyError(r.error)); else { setNotice("Comissão atualizada."); setEdit(null); setNote(""); setAmount(""); await load(); }
  }
  return <View style={{ gap: 10 }}>
    <Text style={ui.h2}>Comissões dos anúncios</Text>
    <Chips options={[{ value: "submitted" as const, label: "Por confirmar" }, { value: "overdue" as const, label: "Em atraso" }, { value: "due" as const, label: "Por pagar" }, { value: "paid" as const, label: "Pagas" }]} value={status} onChange={setStatus} />
    <Message error={error} ok={notice} />
    {items.length === 0 && <Text style={ui.text}>Sem comissões.</Text>}
    {items.map(c => <View key={c.id} style={ui.card}>
      <Text style={ui.h2}>{formatPrice(c.amount)} · {COMMISSION_STATUS_LABELS[c.status]}</Text>
      <Text style={ui.text}>{c.listing_title} · {c.owner_name}{c.phone ? " · " + c.phone : ""}</Text>
      <Text style={ui.muted}>Venda {formatPrice(c.sale_amount)}{c.listed_price != null ? " (anunciado " + formatPrice(c.listed_price) + ")" : ""} · prazo {new Date(c.due_at).toLocaleDateString("pt-AO")}</Text>
      {!!c.reference && <Text style={ui.text}>Ref.: {c.reference}</Text>}
      {!!c.proof_path && <Button title="📄 Comprovativo" variant="secondary" onPress={async () => { const r = await paymentProofUrl(supabase(), c.proof_path!); if (r.data) void Linking.openURL(r.data); }} />}
      {(c.status === "submitted" || c.status === "due") && (edit === c.id ? <>
        <TextInput style={ui.input} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder="Valor real da venda (para corrigir)" placeholderTextColor={C.muted} accessibilityLabel="Valor real da venda" />
        <TextInput style={ui.input} value={note} onChangeText={setNote} placeholder="Motivo / nota" placeholderTextColor={C.muted} accessibilityLabel="Motivo" />
        {!!amount && <Button title="Corrigir valor" onPress={() => void act(c, "adjust")} />}
        {c.status === "submitted" && <Button title="✖ Não recebido" variant="secondary" onPress={() => void act(c, "reject")} />}
        <Button title="Anular comissão" variant="secondary" onPress={() => void act(c, "waive")} />
        <Button title="Voltar" variant="secondary" onPress={() => setEdit(null)} />
      </> : <>
        <Button title="✔ Confirmar pagamento" onPress={() => Alert.alert("Confirmar pagamento", formatPrice(c.amount) + " de " + c.owner_name + "?", [{ text: "Não" }, { text: "Confirmar", onPress: () => void act(c, "confirm") }])} />
        <Button title="Outras ações" variant="secondary" onPress={() => { setEdit(c.id); setNote(""); setAmount(""); }} />
      </>)}
    </View>)}
  </View>;
}

/** Administração: receitas confirmadas de um mês. */
export function AdminRevenue() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState<RevenueRow[]>([]); const [error, setError] = useState("");
  useEffect(() => { if (!/^\d{4}-\d{2}$/.test(month)) return; const { from, to } = monthRange(month);
    void listRevenue(supabase(), from, to).then(r => { if (r.error) setError(friendlyError(r.error)); else { setError(""); setRows(r.data); } }); }, [month]);
  const shift = (d: number) => { const [y, m] = month.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1 + d, 1)); setMonth(t.toISOString().slice(0, 7)); };
  const sum = revenueSummary(rows);
  return <View style={{ gap: 10 }}>
    <Text style={ui.h2}>💰 Receitas</Text>
    <View style={ui.row}><Button title="← Mês anterior" variant="secondary" onPress={() => shift(-1)} /><Text style={ui.label}>{month.slice(5)}/{month.slice(0, 4)}</Text><Button title="Mês seguinte →" variant="secondary" onPress={() => shift(1)} /></View>
    <Message error={error} />
    <View style={ui.card}><Text style={ui.text}>Total do mês</Text><Text style={ui.price}>{formatPrice(sum.total)}</Text><Text style={ui.muted}>{sum.count} pagamento(s)</Text></View>
    {(Object.keys(REVENUE_KIND_LABELS) as RevenueKind[]).map(k => <Text key={k} style={ui.text}>{REVENUE_KIND_LABELS[k]}: {formatPrice(sum.byKind[k] ?? 0)}</Text>)}
    {rows.length > 0 && <Button title="Partilhar lista (CSV)" variant="secondary" onPress={() => void Share.share({ title: `Receitas ${month}`, message: revenueCsv(rows) })} />}
    {rows.length === 0 && <Text style={ui.text}>Sem receitas confirmadas neste mês.</Text>}
    {rows.map((r, i) => <View key={i} style={ui.card}>
      <Text style={ui.label}>{formatPrice(r.amount)} · {REVENUE_KIND_LABELS[r.kind]}</Text>
      <Text style={ui.text}>{r.description} · {r.payer_name}</Text>
      <Text style={ui.muted}>{new Date(r.paid_at).toLocaleString("pt-AO")}{r.method ? " · " + PLAN_METHOD_LABELS[r.method] : ""}{r.reference ? " · Ref.: " + r.reference : ""}</Text>
    </View>)}
  </View>;
}
