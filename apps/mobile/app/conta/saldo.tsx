import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { getMyWallet, savePayoutAccount, requestPayout, cancelPayout, validatePayoutAccount, validatePayoutAmount, walletBalance, payoutDaysText, nextPayoutDate,
  formatDay, formatPrice, friendlyError, WALLET_KIND_LABELS, PAYOUT_STATUS_LABELS, PAYOUT_METHOD_LABELS, type Wallet, type PayoutMethod } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { C, ui } from "../../lib/ui";
import { Button, Chips, Message } from "../../components/Ui";

export default function Saldo() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [w, setW] = useState<Wallet | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false); const [method, setMethod] = useState<PayoutMethod>("iban"); const [holder, setHolder] = useState(""); const [dest, setDest] = useState("");
  const [amount, setAmount] = useState("");
  async function load() { const r = await getMyWallet(supabase()); if (r.error) setError(friendlyError(r.error)); else setW(r.data); }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []));
  async function run(p: PromiseLike<{ error: any }>, msg: string) {
    setBusy(true); setError(""); setNotice("");
    const r = await p; setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(msg); setEditing(false); setAmount(""); await load(); }
  }
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <View style={ui.screen}><Text style={ui.h1}>O meu saldo</Text><Button title="Entrar" onPress={() => router.push("/login")} /></View>;
  const b = walletBalance(w), min = Number(w?.payout_min_kz ?? 0), next = nextPayoutDate(w?.payout_weekdays);
  const open = (w?.payouts ?? []).find(p => p.status === "requested" || p.status === "processing");
  function saveAccount() {
    const bad = validatePayoutAccount({ method, holder, destination: dest }); if (bad) { setError(bad); return; }
    void run(savePayoutAccount(supabase(), { method, holder, destination: dest }), "Conta guardada.");
  }
  function ask() {
    const value = amount.trim() ? Number(amount.replace(/\s/g, "").replace(",", ".")) : b.available;
    const bad = validatePayoutAmount(value, b.available, min); if (bad) { setError(bad); return; }
    Alert.alert("Pedir levantamento", `${formatPrice(value)} para ${w?.account?.destination}?`, [{ text: "Não", style: "cancel" },
      { text: "Pedir", onPress: () => void run(requestPayout(supabase(), value), `Pedido enviado. Os levantamentos são pagos às ${payoutDaysText(w?.payout_weekdays)}.`) }]);
  }
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>← A sua conta</Link>
    <Text style={ui.h1}>💰 O meu saldo</Text>
    <Text style={ui.text}>Aqui fica o dinheiro das vendas da Loja pagas com «Pagamento protegido». Passa a «disponível» quando o cliente confirma que recebeu (ou {w?.auto_release_days ?? 3} dias depois da entrega, sem reclamação).</Text>
    <Message error={error} ok={notice} />
    <View style={ui.card}>
      <Text style={ui.text}>Disponível para levantar</Text><Text style={ui.h1}>{formatPrice(b.available)}</Text>
      <Text style={ui.text}>Guardado (à espera da entrega): <Text style={ui.label}>{formatPrice(b.pending)}</Text></Text>
      <Text style={ui.text}>Em levantamento: <Text style={ui.label}>{formatPrice(b.inPayout)}</Text> · Já recebeu: {formatPrice(w?.paid_out ?? 0)}</Text>
      {Number(w?.fee_pct ?? 0) > 0 && <Text style={ui.muted}>Comissão nas vendas protegidas: {String(w?.fee_pct)}% (já descontada ao libertar).</Text>}
    </View>

    <View style={ui.card}>
      <Text style={ui.h2}>Para onde enviamos o dinheiro</Text>
      {w?.account && !editing ? <>
        <Text style={ui.text} selectable>{PAYOUT_METHOD_LABELS[w.account.method]}: <Text style={ui.label}>{w.account.destination}</Text></Text>
        <Text style={ui.text}>Titular: {w.account.holder_name}</Text>
        <Button title="Mudar conta" variant="secondary" onPress={() => { setEditing(true); setMethod(w.account!.method); setHolder(w.account!.holder_name); setDest(""); }} />
      </> : <>
        <Chips options={(Object.keys(PAYOUT_METHOD_LABELS) as PayoutMethod[]).map(k => ({ value: k, label: PAYOUT_METHOD_LABELS[k] }))} value={method} onChange={setMethod} />
        <Text style={ui.label}>Nome do titular</Text>
        <TextInput style={ui.input} value={holder} onChangeText={setHolder} maxLength={120} accessibilityLabel="Nome do titular" />
        <Text style={ui.label}>{method === "iban" ? "IBAN (AO06 + 21 algarismos)" : "Número Multicaixa Express"}</Text>
        <TextInput style={ui.input} value={dest} onChangeText={setDest} keyboardType={method === "iban" ? "default" : "phone-pad"} autoCapitalize="characters"
          placeholder={method === "iban" ? "AO06 0000 0000 0000 0000 0000 0" : "9xx xxx xxx"} placeholderTextColor={C.muted} accessibilityLabel={method === "iban" ? "IBAN" : "Número Multicaixa Express"} />
        <Text style={ui.muted}>🔒 Só a administração vê estes dados, para lhe pagar.</Text>
        <Button title="Guardar conta" disabled={busy} onPress={saveAccount} />
        {editing && <Button title="Cancelar" variant="secondary" onPress={() => setEditing(false)} />}
      </>}
    </View>

    <View style={ui.card}>
      <Text style={ui.h2}>Pedir levantamento</Text>
      <Text style={ui.text}>Os levantamentos são pagos às {payoutDaysText(w?.payout_weekdays)}{next ? ` (próximo: ${formatDay(next)})` : ""}. Mínimo: {formatPrice(min)}.</Text>
      {open ? <>
        <Text style={ui.ok}>⏳ L-{open.ref_no}: {formatPrice(open.amount)} — {PAYOUT_STATUS_LABELS[open.status]}</Text>
        {open.status === "requested" && <Button title="Cancelar pedido" variant="secondary" disabled={busy} onPress={() => Alert.alert("Cancelar pedido", "O dinheiro volta ao saldo disponível.", [{ text: "Não", style: "cancel" }, { text: "Cancelar pedido", onPress: () => void run(cancelPayout(supabase(), open.id), "Pedido cancelado.") }])} />}
      </> : <>
        <TextInput style={ui.input} keyboardType="number-pad" value={amount} onChangeText={setAmount} placeholder={"Valor (vazio = tudo: " + formatPrice(b.available) + ")"} placeholderTextColor={C.muted} accessibilityLabel="Valor a levantar" />
        <Button title="💸 Pedir levantamento" disabled={busy || !w?.account || b.available < Math.max(min, 1)} onPress={ask} />
        {!w?.account && <Text style={ui.muted}>Primeiro indique a conta para onde quer receber.</Text>}
      </>}
    </View>

    <Text style={ui.h2}>Levantamentos</Text>
    {(w?.payouts ?? []).length === 0 && <Text style={ui.text}>Ainda não pediu levantamentos.</Text>}
    {(w?.payouts ?? []).map(p => <View key={p.id} style={ui.card}>
      <Text style={ui.label}>L-{p.ref_no} · {formatPrice(p.amount)} · {PAYOUT_STATUS_LABELS[p.status]}</Text>
      <Text style={ui.text}>{p.destination}</Text>
      <Text style={ui.muted}>{new Date(p.created_at).toLocaleString("pt-AO")}{p.paid_at ? " · Pago " + new Date(p.paid_at).toLocaleString("pt-AO") : ""}{p.bank_reference ? " · Ref.: " + p.bank_reference : ""}</Text>
      {!!p.admin_note && <Text style={ui.muted}>Nota: {p.admin_note}</Text>}
    </View>)}
    <Text style={ui.h2}>Movimentos</Text>
    {(w?.entries ?? []).length === 0 && <Text style={ui.text}>Sem movimentos. Quando vender com Pagamento protegido, aparecem aqui.</Text>}
    {(w?.entries ?? []).map(e => <View key={e.id} style={[ui.row, { justifyContent: "space-between", borderBottomWidth: 1, borderColor: C.line, paddingBottom: 6 }]}>
      <View style={{ flex: 1 }}><Text style={ui.text}>{WALLET_KIND_LABELS[e.kind]}</Text><Text style={ui.muted}>{e.note ? e.note + " · " : ""}{e.bucket === "pending" ? "guardado" : "disponível"}</Text></View>
      <Text style={Number(e.amount) < 0 ? ui.error : ui.label}>{Number(e.amount) > 0 ? "+" : ""}{formatPrice(e.amount)}</Text>
    </View>)}
  </ScrollView>;
}
