import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { getMyWallet, savePayoutAccount, requestPayout, cancelPayout, validatePayoutAccount, validatePayoutAmount, walletBalance, payoutDaysText, nextPayoutDate,
  formatPrice, friendlyErrorIn, WALLET_KIND_LABELS, PAYOUT_STATUS_LABELS, PAYOUT_METHOD_LABELS, type Wallet, type PayoutMethod } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { C, ui } from "../../lib/ui";
import { Button, Chips, Message } from "../../components/Ui";
import { useT, formatDayIn, formatDateTimeIn } from "../../lib/i18n";

export default function Saldo() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [w, setW] = useState<Wallet | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false); const [method, setMethod] = useState<PayoutMethod>("iban"); const [holder, setHolder] = useState(""); const [dest, setDest] = useState("");
  const [amount, setAmount] = useState("");
  async function load() { const r = await getMyWallet(supabase()); if (r.error) setError(friendlyErrorIn(r.error, lang)); else setW(r.data); }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []));
  async function run(p: PromiseLike<{ error: any }>, msg: string) {
    setBusy(true); setError(""); setNotice("");
    const r = await p; setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(msg); setEditing(false); setAmount(""); await load(); }
  }
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></View>;
  if (!uid) return <View style={ui.screen}><Text style={ui.h1}>{t("sh.my_balance")}</Text><Button title={t("auth.login")} onPress={() => router.push("/login")} /></View>;
  const b = walletBalance(w), min = Number(w?.payout_min_kz ?? 0), next = nextPayoutDate(w?.payout_weekdays);
  const open = (w?.payouts ?? []).find(p => p.status === "requested" || p.status === "processing");
  function saveAccount() {
    const bad = validatePayoutAccount({ method, holder, destination: dest }); if (bad) { setError(tc(bad)); return; }
    void run(savePayoutAccount(supabase(), { method, holder, destination: dest }), t("sh.account_saved"));
  }
  function ask() {
    const value = amount.trim() ? Number(amount.replace(/\s/g, "").replace(",", ".")) : b.available;
    const bad = validatePayoutAmount(value, b.available, min); if (bad) { setError(tc(bad)); return; }
    Alert.alert(t("sh.request_payout"), t("sh.payout_confirm", { price: formatPrice(value), dest: w?.account?.destination ?? "" }), [{ text: t("sh.no"), style: "cancel" },
      { text: t("sh.request"), onPress: () => void run(requestPayout(supabase(), value), t("sh.payout_requested", { days: tc(payoutDaysText(w?.payout_weekdays)) })) }]);
  }
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>{"← " + t("nav.account")}</Link>
    <Text style={ui.h1}>{"💰 " + t("sh.my_balance")}</Text>
    <Text style={ui.text}>{t("sh.balance_intro", { days: w?.auto_release_days ?? 3 })}</Text>
    <Message error={error} ok={notice} />
    <View style={ui.card}>
      <Text style={ui.text}>{t("sh.available_to_withdraw")}</Text><Text style={ui.h1}>{formatPrice(b.available)}</Text>
      <Text style={ui.text}>{t("sh.held_waiting")} <Text style={ui.label}>{formatPrice(b.pending)}</Text></Text>
      <Text style={ui.text}>{t("sh.in_payout")} <Text style={ui.label}>{formatPrice(b.inPayout)}</Text> · {t("sh.paid_out", { price: formatPrice(w?.paid_out ?? 0) })}</Text>
      {Number(w?.fee_pct ?? 0) > 0 && <Text style={ui.muted}>{t("sh.fee_note", { pct: String(w?.fee_pct) })}</Text>}
    </View>

    <View style={ui.card}>
      <Text style={ui.h2}>{t("sh.where_send")}</Text>
      {w?.account && !editing ? <>
        <Text style={ui.text} selectable>{tc(PAYOUT_METHOD_LABELS[w.account.method])}: <Text style={ui.label}>{w.account.destination}</Text></Text>
        <Text style={ui.text}>{t("sh.holder", { name: w.account.holder_name })}</Text>
        <Button title={t("sh.change_account")} variant="secondary" onPress={() => { setEditing(true); setMethod(w.account!.method); setHolder(w.account!.holder_name); setDest(""); }} />
      </> : <>
        <Chips options={(Object.keys(PAYOUT_METHOD_LABELS) as PayoutMethod[]).map(k => ({ value: k, label: tc(PAYOUT_METHOD_LABELS[k]) }))} value={method} onChange={setMethod} />
        <Text style={ui.label}>{t("sh.holder_name")}</Text>
        <TextInput style={ui.input} value={holder} onChangeText={setHolder} maxLength={120} accessibilityLabel={t("sh.holder_name")} />
        <Text style={ui.label}>{method === "iban" ? t("sh.iban_label") : t("sh.express_number")}</Text>
        <TextInput style={ui.input} value={dest} onChangeText={setDest} keyboardType={method === "iban" ? "default" : "phone-pad"} autoCapitalize="characters"
          placeholder={method === "iban" ? "AO06 0000 0000 0000 0000 0000 0" : "9xx xxx xxx"} placeholderTextColor={C.muted} accessibilityLabel={method === "iban" ? "IBAN" : t("sh.express_number")} />
        <Text style={ui.muted}>{t("sh.admin_only_data")}</Text>
        <Button title={t("sh.save_account")} disabled={busy} onPress={saveAccount} />
        {editing && <Button title={t("common.cancel")} variant="secondary" onPress={() => setEditing(false)} />}
      </>}
    </View>

    <View style={ui.card}>
      <Text style={ui.h2}>{t("sh.request_payout")}</Text>
      <Text style={ui.text}>{t("sh.payout_days", { days: tc(payoutDaysText(w?.payout_weekdays)) })}{next ? " " + t("sh.next_date", { date: formatDayIn(next.getTime() - 3600000, lang) }) : ""}. {t("sh.minimum", { price: formatPrice(min) })}</Text>
      {open ? <>
        <Text style={ui.ok}>⏳ L-{open.ref_no}: {formatPrice(open.amount)} — {tc(PAYOUT_STATUS_LABELS[open.status])}</Text>
        {open.status === "requested" && <Button title={t("sh.cancel_request")} variant="secondary" disabled={busy} onPress={() => Alert.alert(t("sh.cancel_request"), t("sh.money_back"), [{ text: t("sh.no"), style: "cancel" }, { text: t("sh.cancel_request"), onPress: () => void run(cancelPayout(supabase(), open.id), t("sh.request_cancelled")) }])} />}
      </> : <>
        <TextInput style={ui.input} keyboardType="number-pad" value={amount} onChangeText={setAmount} placeholder={t("sh.amount_ph", { price: formatPrice(b.available) })} placeholderTextColor={C.muted} accessibilityLabel={t("sh.amount_a11y")} />
        <Button title={"💸 " + t("sh.request_payout")} disabled={busy || !w?.account || b.available < Math.max(min, 1)} onPress={ask} />
        {!w?.account && <Text style={ui.muted}>{t("sh.first_account")}</Text>}
      </>}
    </View>

    <Text style={ui.h2}>{t("sh.payouts")}</Text>
    {(w?.payouts ?? []).length === 0 && <Text style={ui.text}>{t("sh.no_payouts")}</Text>}
    {(w?.payouts ?? []).map(p => <View key={p.id} style={ui.card}>
      <Text style={ui.label}>L-{p.ref_no} · {formatPrice(p.amount)} · {tc(PAYOUT_STATUS_LABELS[p.status])}</Text>
      <Text style={ui.text}>{p.destination}</Text>
      <Text style={ui.muted}>{formatDateTimeIn(p.created_at, lang)}{p.paid_at ? " · " + t("sh.paid_at", { date: formatDateTimeIn(p.paid_at, lang) }) : ""}{p.bank_reference ? " · " + t("sh.ref", { ref: p.bank_reference }) : ""}</Text>
      {!!p.admin_note && <Text style={ui.muted}>{t("sh.note", { text: p.admin_note })}</Text>}
    </View>)}
    <Text style={ui.h2}>{t("sh.movements")}</Text>
    {(w?.entries ?? []).length === 0 && <Text style={ui.text}>{t("sh.no_movements")}</Text>}
    {(w?.entries ?? []).map(e => <View key={e.id} style={[ui.row, { justifyContent: "space-between", borderBottomWidth: 1, borderColor: C.line, paddingBottom: 6 }]}>
      <View style={{ flex: 1 }}><Text style={ui.text}>{tc(WALLET_KIND_LABELS[e.kind])}</Text><Text style={ui.muted}>{e.note ? e.note + " · " : ""}{e.bucket === "pending" ? t("sh.bucket_held") : t("sh.bucket_available")}</Text></View>
      <Text style={Number(e.amount) < 0 ? ui.error : ui.label}>{Number(e.amount) > 0 ? "+" : ""}{formatPrice(e.amount)}</Text>
    </View>)}
  </ScrollView>;
}
