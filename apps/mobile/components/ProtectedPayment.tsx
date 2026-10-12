import { useEffect, useState } from "react";
import { Link } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Linking, Share, Switch, Text, TextInput, View } from "react-native";
import { escrowBuyerStep, escrowSellerStep, canPayOrder, canConfirmReceived, submitOrderPayment, requestPaymentReference, confirmOrderReceived,
  uploadPaymentProof, paymentProofUrl, base64ToArrayBuffer, formatPrice, formatRef, friendlyError, timeLeftText, ESCROW_STATUS_LABELS, ORDER_PAY_METHOD_LABELS,
  getProtectedSettings, updateProtectedSettings, getEscrowSummary, listOrderPaymentsForAdmin, decideOrderPayment, listPayoutsForAdmin, startPayoutBatch,
  markPayoutsPaid, rejectPayout, payoutsCsv, payoutsTotal, payoutDaysText, PAYOUT_STATUS_LABELS, PAYOUT_METHOD_LABELS,
  type ProtectedOrderFields, type OrderPayMethod, type PlatformSettings, type ProtectedSettings, type EscrowSummary, type AdminOrderPayment,
  type AdminPayout, type PayoutStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { shrinkAsset } from "../lib/image";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { PaymentDetails } from "./Plans";

type Ref = { entity: string; reference: string; amount: number | string; expires_at: string | null };

/** Pagar uma encomenda protegida: referência ProxyPay (automático) ou transferência/Express com comprovativo. */
function PayOrder({ order, uid, settings, provider, onDone }: { order: ProtectedOrderFields; uid: string; settings: PlatformSettings | null; provider: "manual" | "proxypay"; onDone: (msg: string) => void }) {
  const [method, setMethod] = useState<OrderPayMethod>("multicaixa_express");
  const [reference, setReference] = useState(""); const [proof, setProof] = useState<{ uri: string; base64?: string | null; mimeType: string } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [ref, setRef] = useState<Ref | null>(order.payment?.provider === "proxypay" && order.payment.status === "pending" && order.payment.reference
    ? { entity: order.payment.entity ?? "", reference: order.payment.reference, amount: order.payment.amount, expires_at: order.payment.expires_at } : null);
  const code = order.ref_no ? formatRef("order", order.ref_no) : "";
  async function pick(camera: boolean) {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError(camera ? "Autorize a câmara." : "Autorize o acesso à galeria."); return; }
    const r = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!r.canceled && r.assets?.[0]) setProof(await shrinkAsset(r.assets[0]));
  }
  async function getReference() {
    setBusy(true); setError("");
    const r = await requestPaymentReference(supabase(), order.id);
    setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else setRef(r.data);
  }
  async function send() {
    if (!reference.trim() && !proof) { setError("Escreva a referência do pagamento ou junte o comprovativo."); return; }
    setBusy(true); setError("");
    try {
      let path: string | null = null;
      if (proof) {
        const body = proof.base64 ? base64ToArrayBuffer(proof.base64) : await (await fetch(proof.uri)).arrayBuffer();
        const up = await uploadPaymentProof(supabase(), uid, body, "comprovativo.jpg", proof.mimeType || "image/jpeg");
        if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar o comprovativo."); path = up.data;
      }
      const r = await submitOrderPayment(supabase(), order.id, { method, reference, proofPath: path });
      if (r.error) throw r.error;
      onDone("Comprovativo enviado. Vamos confirmar e avisá-lo; o vendedor só envia depois disso.");
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  if (provider === "proxypay") return <View style={{ gap: 8 }}>
    {ref ? <View style={[ui.card, { gap: 4 }]}>
      <Text style={ui.text} selectable>Entidade: <Text style={ui.h2}>{ref.entity}</Text></Text>
      <Text style={ui.text} selectable>Referência: <Text style={ui.h2}>{ref.reference.replace(/(\d{3})(?=\d)/g, "$1 ")}</Text></Text>
      <Text style={ui.text}>Montante: <Text style={ui.h2}>{formatPrice(ref.amount)}</Text></Text>
      {!!ref.expires_at && <Text style={ui.muted}>Válida: {timeLeftText(ref.expires_at)}</Text>}
    </View> : <Button title={busy ? "A gerar…" : "🔢 Gerar referência de pagamento"} disabled={busy} onPress={() => void getReference()} />}
    <Text style={ui.muted}>Pague em «Pagamentos → Pagamento por referência» no Multicaixa Express, num ATM ou no banco. A confirmação chega sozinha.</Text>
    <Message error={error} />
  </View>;
  return <View style={{ gap: 10 }}>
    <Text style={ui.label}>1. Pague {formatPrice(order.total)} para o Huambo Online</Text>
    <PaymentDetails s={settings} />
    {!!code && <Text style={ui.text}>No descritivo escreva <Text style={ui.label}>{code}</Text>.</Text>}
    <Text style={ui.label}>2. Diga-nos como pagou</Text>
    <Chips options={(Object.keys(ORDER_PAY_METHOD_LABELS) as OrderPayMethod[]).map(k => ({ value: k, label: ORDER_PAY_METHOD_LABELS[k] }))} value={method} onChange={setMethod} />
    <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder="Referência ou número da operação" placeholderTextColor={C.muted} accessibilityLabel="Referência do pagamento" />
    {proof ? <View style={{ gap: 6 }}><Image source={{ uri: proof.uri }} style={{ width: 120, height: 120, borderRadius: 10 }} accessibilityLabel="Comprovativo" /><Button title="Tirar comprovativo" variant="secondary" onPress={() => setProof(null)} /></View>
      : <View style={ui.row}><Button title="📷 Fotografar comprovativo" variant="secondary" onPress={() => void pick(true)} /><Button title="🖼️ Galeria" variant="secondary" onPress={() => void pick(false)} /></View>}
    <Text style={ui.muted}>🔒 O comprovativo fica privado: só a administração o vê.</Text>
    <Message error={error} />
    <Button title={busy ? "A enviar…" : "Enviar comprovativo"} disabled={busy} onPress={() => void send()} />
  </View>;
}

/** Caixa do pagamento protegido dentro de cada encomenda (comprador ou vendedor). */
export function OrderEscrowPanel({ order, role, uid, settings, provider, hasActiveDispute, onChanged }: {
  order: ProtectedOrderFields; role: "buyer" | "seller"; uid: string; settings: PlatformSettings | null; provider: "manual" | "proxypay";
  hasActiveDispute: boolean; onChanged: (msg: string, error?: boolean) => void }) {
  const [paying, setPaying] = useState(false); const [busy, setBusy] = useState(false);
  if (!order.protected || !order.escrow_status) return null;
  const step = role === "buyer" ? escrowBuyerStep(order, hasActiveDispute) : escrowSellerStep(order);
  async function received() {
    setBusy(true);
    const r = await confirmOrderReceived(supabase(), order.id);
    setBusy(false);
    if (r.error) onChanged(friendlyError(r.error), true); else onChanged("Obrigado! O pagamento foi entregue ao vendedor. Não se esqueça de o avaliar.");
  }
  return <View style={[ui.card, { borderWidth: 2 }]}>
    <Text style={ui.label}>{order.status === "cancelled" && order.escrow_status === "awaiting_payment" ? "🛡️ Pagamento protegido — cancelada" : ESCROW_STATUS_LABELS[order.escrow_status]}</Text>
    <Text style={ui.text}>{step}</Text>
    {role === "buyer" && order.payment?.status === "rejected" && !!order.payment.admin_note && order.escrow_status === "awaiting_payment" && <Text style={ui.error}>Último comprovativo não confirmado: {order.payment.admin_note}</Text>}
    {role === "buyer" && canPayOrder(order) && (paying || provider === "proxypay"
      ? <PayOrder order={order} uid={uid} settings={settings} provider={provider} onDone={m => { setPaying(false); onChanged(m); }} />
      : <Button title="💳 Pagar agora" onPress={() => setPaying(true)} />)}
    {role === "buyer" && canConfirmReceived(order, hasActiveDispute) && <Button title="✅ Confirmar receção" disabled={busy} onPress={() => Alert.alert("Confirmar receção",
      "Recebeu a encomenda e está tudo bem? O pagamento passa para o vendedor.", [{ text: "Não", style: "cancel" }, { text: "Sim, recebi", onPress: () => void received() }])} />}
    {role === "seller" && order.escrow_status === "released" && <Link href={"/conta/saldo" as any} style={ui.link}>💰 Ver o meu saldo →</Link>}
  </View>;
}

/** Administração do pagamento protegido: definições, pagamentos por confirmar e levantamentos. */
export function AdminProtected() {
  const [s, setS] = useState<ProtectedSettings | null>(null); const [sum, setSum] = useState<EscrowSummary | null>(null);
  const [payments, setPayments] = useState<AdminOrderPayment[]>([]); const [payStatus, setPayStatus] = useState<"pending" | "confirmed" | "rejected">("pending");
  const [payouts, setPayouts] = useState<AdminPayout[]>([]); const [poStatus, setPoStatus] = useState<PayoutStatus>("requested");
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const [noteFor, setNoteFor] = useState<string | null>(null); const [note, setNote] = useState(""); const [bankRef, setBankRef] = useState("");
  async function load() {
    const [a, b, c, d] = await Promise.all([getProtectedSettings(supabase()), getEscrowSummary(supabase()), listOrderPaymentsForAdmin(supabase(), payStatus), listPayoutsForAdmin(supabase(), poStatus)]);
    setS(a.data); setSum(b.data); setPayments(c.data); setPayouts(d.data);
    const err = a.error ?? b.error ?? c.error ?? d.error; if (err) setError(friendlyError(err));
  }
  useEffect(() => { void load(); }, [payStatus, poStatus]);
  async function ok(p: PromiseLike<{ error: any }>, msg: string) {
    setBusy(true); setError(""); setNotice("");
    const r = await p; setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(msg); setNoteFor(null); setNote(""); await load(); }
  }
  function saveSettings() {
    if (!s) return;
    const num = (v: unknown) => Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
    const fee = num(s.protected_fee_pct), days = Number(s.auto_release_days), hours = Number(s.payment_window_hours), min = num(s.payout_min_kz);
    if (!(fee >= 0 && fee <= 20) || !Number.isInteger(days) || days < 1 || days > 30 || !Number.isInteger(hours) || hours < 1 || hours > 168 || !(min >= 0)) { setError("Verifique a comissão (0 a 20%), os dias (1 a 30), as horas (1 a 168) e o mínimo."); return; }
    if (s.payment_provider === "proxypay" && !/^\d{3,6}$/.test(String(s.proxypay_entity ?? ""))) { setError("Escreva o número da Entidade dado pela ProxyPay."); return; }
    if (!s.payout_weekdays?.length) { setError("Escolha pelo menos um dia de pagamentos."); return; }
    void ok(updateProtectedSettings(supabase(), { protected_enabled: !!s.protected_enabled, payment_provider: s.payment_provider, proxypay_entity: s.proxypay_entity?.trim() || null,
      protected_fee_pct: fee, auto_release_days: days, payment_window_hours: hours, payout_min_kz: min, payout_weekdays: s.payout_weekdays }), "Definições guardadas.");
  }
  async function batch() {
    setError(""); setNotice("");
    const r = await startPayoutBatch(supabase());
    if (r.error) { setError(friendlyError(r.error)); return; }
    const list = await listPayoutsForAdmin(supabase(), "processing");
    const rows = list.data.filter(p => p.batch_id === r.data);
    setPoStatus("processing");
    setNotice("Lote criado. Envie o ficheiro para o computador e pague no banco; depois marque o lote como pago.");
    void Share.share({ title: "Levantamentos Huambo Online", message: payoutsCsv(rows) });
  }
  const set = (k: keyof ProtectedSettings) => (v: string) => s && setS({ ...s, [k]: v } as ProtectedSettings);
  const toggleDay = (d: number) => s && setS({ ...s, payout_weekdays: (s.payout_weekdays ?? []).includes(d) ? (s.payout_weekdays ?? []).filter(x => x !== d) : [...(s.payout_weekdays ?? []), d].sort() });
  const processing = payouts.filter(p => p.status === "processing");
  return <View style={{ gap: 12 }}>
    <Text style={ui.h2}>🛡️ Pagamento protegido</Text>
    <Text style={ui.text}>O comprador paga ao Huambo Online; o dinheiro fica guardado até ele confirmar que recebeu. Depois passa para o saldo do vendedor, que pede o levantamento.</Text>
    <Message error={error} ok={notice} />
    {!!sum && <View style={ui.card}>
      <Text style={ui.text}>Dinheiro guardado: <Text style={ui.label}>{formatPrice(sum.held)}</Text></Text>
      <Text style={ui.text}>Saldo dos vendedores: <Text style={ui.label}>{formatPrice(sum.available)}</Text></Text>
      <Text style={ui.text}>Levantamentos em curso: <Text style={ui.label}>{formatPrice(sum.payouts_open)}</Text> ({sum.payouts_requested} novo(s) · {sum.payouts_processing} no banco)</Text>
      <Text style={ui.text}>Comprovativos por confirmar: <Text style={ui.label}>{sum.payments_pending}</Text> · À espera de pagamento: {sum.awaiting_payment}</Text>
      <Text style={ui.text}>Reembolsos a enviar: <Text style={ui.label}>{sum.refunds_to_send}</Text> (em «Disputas»)</Text>
      <Text style={ui.text}>Comissões (30 dias): <Text style={ui.label}>{formatPrice(sum.fees_30d)}</Text></Text>
    </View>}

    <Text style={ui.h2}>Pagamentos das encomendas</Text>
    <Chips options={[{ value: "pending" as const, label: "Por confirmar" }, { value: "confirmed" as const, label: "Confirmados" }, { value: "rejected" as const, label: "Recusados" }]} value={payStatus} onChange={setPayStatus} />
    {payments.length === 0 && <Text style={ui.text}>Sem pagamentos.</Text>}
    {payments.map(p => <View key={p.id} style={ui.card}>
      <Text style={ui.h2}>{formatPrice(p.amount)} · {p.order_ref}</Text>
      <Text style={ui.text}>Comprador: {p.buyer_name}{p.buyer_phone ? " · " + p.buyer_phone : ""} · Vendedor: {p.seller_name}</Text>
      <Text style={ui.muted}>{p.provider === "proxypay" ? `ProxyPay · Entidade ${p.entity} · Ref. ${p.reference}` : `${ORDER_PAY_METHOD_LABELS[p.method as OrderPayMethod] ?? p.method}${p.reference ? " · Ref.: " + p.reference : ""}`} · {new Date(p.created_at).toLocaleString("pt-AO")}</Text>
      {p.paid_amount != null && Number(p.paid_amount) !== Number(p.amount) && <Text style={ui.error}>Valor pago: {formatPrice(p.paid_amount)}</Text>}
      {!!p.admin_note && <Text style={ui.muted}>Nota: {p.admin_note}</Text>}
      {!!p.proof_path && <Button title="📄 Ver comprovativo" variant="secondary" onPress={async () => { const r = await paymentProofUrl(supabase(), p.proof_path!); if (r.data) void Linking.openURL(r.data); else setError(friendlyError(r.error)); }} />}
      {p.status === "pending" && p.provider === "manual" && (noteFor === p.id ? <>
        <TextInput style={[ui.input, ui.area]} multiline value={note} onChangeText={setNote} placeholder="Porque não confirma? (o comprador vai ler)" placeholderTextColor={C.muted} accessibilityLabel="Motivo" />
        <Button title="✖ Não recebido" variant="danger" disabled={busy || !note.trim()} onPress={() => void ok(decideOrderPayment(supabase(), p.id, false, note), "Pagamento recusado.")} />
        <Button title="Voltar" variant="secondary" onPress={() => setNoteFor(null)} />
      </> : <>
        <Button title="✔ Dinheiro recebido" disabled={busy} onPress={() => Alert.alert("Confirmar pagamento", `Recebeu ${formatPrice(p.amount)} de ${p.buyer_name} (${p.order_ref})? O vendedor é avisado para enviar.`,
          [{ text: "Não", style: "cancel" }, { text: "Confirmar", onPress: () => void ok(decideOrderPayment(supabase(), p.id, true), "Pagamento confirmado: o dinheiro fica guardado e o vendedor foi avisado.") }])} />
        <Button title="✖ Não recebido" variant="secondary" onPress={() => { setNoteFor(p.id); setNote(""); }} />
      </>)}
    </View>)}

    <Text style={ui.h2}>Levantamentos dos vendedores</Text>
    <Text style={ui.text}>Dias de pagamentos: {payoutDaysText(s?.payout_weekdays)}. Crie o lote, envie o ficheiro para o computador, pague no banco (pagamentos em lote) e marque o lote como pago.</Text>
    <Button title="📦 Criar lote e partilhar ficheiro" disabled={!sum?.payouts_requested} onPress={() => void batch()} />
    <Chips options={(Object.keys(PAYOUT_STATUS_LABELS) as PayoutStatus[]).map(k => ({ value: k, label: PAYOUT_STATUS_LABELS[k] }))} value={poStatus} onChange={setPoStatus} />
    {poStatus === "processing" && processing.length > 0 && <View style={ui.card}>
      <TextInput style={ui.input} value={bankRef} onChangeText={setBankRef} placeholder="Referência do lote no banco (opcional)" placeholderTextColor={C.muted} accessibilityLabel="Referência do lote" />
      <Button title={`✔ Marcar lote como pago (${processing.length} · ${formatPrice(payoutsTotal(processing))})`} disabled={busy} onPress={() => Alert.alert("Lote pago", "Confirma que pagou estes levantamentos no banco?",
        [{ text: "Não", style: "cancel" }, { text: "Sim", onPress: () => void ok(markPayoutsPaid(supabase(), processing.map(r => r.id), bankRef), "Levantamentos marcados como pagos. Os vendedores foram avisados.") }])} />
      <Button title="Partilhar ficheiro outra vez" variant="secondary" onPress={() => void Share.share({ title: "Levantamentos Huambo Online", message: payoutsCsv(processing) })} />
    </View>}
    {payouts.length === 0 && <Text style={ui.text}>Sem levantamentos.</Text>}
    {payouts.map(p => <View key={p.id} style={ui.card}>
      <Text style={ui.h2}>L-{p.ref_no} · {formatPrice(p.amount)}</Text>
      <Text style={ui.label}>{PAYOUT_STATUS_LABELS[p.status]}</Text>
      <Text style={ui.text}>{p.holder_name} ({p.user_name}{p.phone ? " · " + p.phone : ""})</Text>
      <Text style={ui.text} selectable>{PAYOUT_METHOD_LABELS[p.method]}: {p.destination}</Text>
      {!!p.admin_note && <Text style={ui.muted}>Nota: {p.admin_note}</Text>}
      {(p.status === "requested" || p.status === "processing") && (noteFor === p.id ? <>
        <TextInput style={[ui.input, ui.area]} multiline value={note} onChangeText={setNote} placeholder="Porque não faz este levantamento? (o vendedor vai ler)" placeholderTextColor={C.muted} accessibilityLabel="Motivo" />
        <Button title="✖ Não fazer (devolver ao saldo)" variant="danger" disabled={busy || !note.trim()} onPress={() => void ok(rejectPayout(supabase(), p.id, note), "Levantamento recusado; o dinheiro voltou ao saldo do vendedor.")} />
        <Button title="Voltar" variant="secondary" onPress={() => setNoteFor(null)} />
      </> : <Button title="✖ Não fazer" variant="secondary" onPress={() => { setNoteFor(p.id); setNote(""); }} />)}
    </View>)}

    {!!s && <View style={ui.card}>
      <Text style={ui.h2}>Definições</Text>
      <View style={[ui.row, { alignItems: "center" }]}>
        <Switch value={!!s.protected_enabled} onValueChange={v => setS({ ...s, protected_enabled: v })} accessibilityLabel="Mostrar «Pagamento protegido» aos compradores" />
        <Text style={[ui.text, { flex: 1 }]}>Mostrar «Pagamento protegido» aos compradores</Text>
      </View>
      <Text style={ui.muted}>Ative só depois de rever os Termos com um jurista e de ter a conta da empresa pronta.</Text>
      <Text style={ui.label}>Como os compradores pagam</Text>
      <Chips options={[{ value: "manual" as const, label: "Comprovativo (manual)" }, { value: "proxypay" as const, label: "Referência ProxyPay" }]} value={s.payment_provider ?? "manual"} onChange={v => setS({ ...s, payment_provider: v })} />
      {s.payment_provider === "proxypay" && <><Text style={ui.label}>Entidade ProxyPay</Text><TextInput style={ui.input} keyboardType="number-pad" value={s.proxypay_entity ?? ""} onChangeText={set("proxypay_entity")} accessibilityLabel="Entidade ProxyPay" />
        <Text style={ui.muted}>Precisa também do segredo PROXYPAY_API_KEY nas Edge Functions do Supabase (e PROXYPAY_ENV=production para pagamentos reais).</Text></>}
      <Text style={ui.label}>Comissão sobre as vendas protegidas (%)</Text><TextInput style={ui.input} keyboardType="decimal-pad" value={String(s.protected_fee_pct ?? "")} onChangeText={set("protected_fee_pct")} accessibilityLabel="Comissão em percentagem" />
      <Text style={ui.label}>Dias depois da entrega para libertar sozinho</Text><TextInput style={ui.input} keyboardType="number-pad" value={String(s.auto_release_days ?? "")} onChangeText={set("auto_release_days")} accessibilityLabel="Dias para libertar" />
      <Text style={ui.label}>Horas para o comprador pagar</Text><TextInput style={ui.input} keyboardType="number-pad" value={String(s.payment_window_hours ?? "")} onChangeText={set("payment_window_hours")} accessibilityLabel="Horas para pagar" />
      <Text style={ui.label}>Mínimo para levantar (Kz)</Text><TextInput style={ui.input} keyboardType="number-pad" value={String(s.payout_min_kz ?? "")} onChangeText={set("payout_min_kz")} accessibilityLabel="Mínimo para levantar" />
      <Text style={ui.label}>Dias de pagamento dos levantamentos</Text>
      <View style={ui.row}>{([[1, "Seg"], [2, "Ter"], [3, "Qua"], [4, "Qui"], [5, "Sex"], [6, "Sáb"]] as [number, string][]).map(([d, l]) =>
        <Button key={d} title={((s.payout_weekdays ?? []).includes(d) ? "✔ " : "") + l} variant={(s.payout_weekdays ?? []).includes(d) ? "primary" : "secondary"} onPress={() => toggleDay(d)} />)}</View>
      <Button title="Guardar" disabled={busy} onPress={saveSettings} />
    </View>}
  </View>;
}
