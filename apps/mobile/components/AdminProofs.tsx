import { useEffect, useState } from "react";
import { Alert, Linking, Text, TextInput, View } from "react-native";
import { listProofChecks, decideProofPayment, paymentProofUrl, formatPrice, friendlyErrorIn, proofMark, PROOF_VERDICT_ICON, type ProofCheck } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { formatDateTimeIn, useT } from "../lib/i18n";
import { C, ui } from "../lib/ui";
import { Button, Message } from "./Ui";

const COLOR: Record<string, string> = { match: "#2E7D32", check: "#E5A800", suspicious: "#C62828", unreadable: "#888888", pending: "#888888" };

/**
 * Comprovativos por decidir: a IA lê o talão e a base de dados confere o valor, a conta de destino,
 * a data e se o n.º da operação já foi usado. A equipa confirma (sempre depois de ver o extrato).
 */
export function AdminProofs() {
  const { lang, t } = useT();
  const [list, setList] = useState<ProofCheck[]>([]); const [err, setErr] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<Record<string, string>>({});
  async function load() { const r = await listProofChecks(supabase()); if (r.error) setErr(friendlyErrorIn(r.error, lang)); else setList(r.data); }
  useEffect(() => { void load(); }, []);
  async function view(path: string) { const r = await paymentProofUrl(supabase(), path); if (r.data) void Linking.openURL(r.data); }
  async function run(p: ProofCheck, confirm: boolean, note: string | null) {
    setBusy(true); setErr(""); setOk("");
    const r = await decideProofPayment(supabase(), p.kind, p.payment_id, confirm, note); setBusy(false);
    if (r.error) { setErr(friendlyErrorIn(r.error, lang)); return; }
    setOk(confirm ? t("pf.ok_confirmed") : t("pf.ok_rejected")); await load();
  }
  return <View style={{ gap: 12 }}>
    <Text style={ui.text}>{t("pf.intro")}</Text>
    <Message error={err} ok={ok} />
    {!list.length && <Text style={ui.muted}>{t("pf.none")}</Text>}
    {list.map(p => {
      const key = p.kind + p.payment_id;
      return <View key={key} style={[ui.card, { borderLeftWidth: 4, borderLeftColor: COLOR[p.verdict] }]}>
        <Text style={ui.h2}>{PROOF_VERDICT_ICON[p.verdict]} {t("pf.verdict." + p.verdict)}</Text>
        <Text style={ui.label}>{p.label}</Text>
        <Text style={ui.text}>{t("pf.expected")}: {formatPrice(p.amount)} · {t("pf.payer")}: {p.payer_name ?? "—"}</Text>
        <Text style={ui.muted}>{formatDateTimeIn(p.created_at, lang)}{p.reference ? ` · ${t("pf.client_ref")}: ${p.reference}` : ""}</Text>
        {!!p.summary && <Text style={ui.text}>🤖 {p.summary}</Text>}
        {p.verdict !== "pending" && p.verdict !== "unreadable" && <Text style={ui.muted}>
          {t("pf.read")}: {t("pf.amount")} {p.read_amount != null ? formatPrice(p.read_amount) : "—"} {proofMark(p.amount_ok)} · {t("pf.destination")} {p.read_destination ?? "—"} {proofMark(p.destination_ok)} · {t("pf.date")} {p.read_date ?? "—"} {proofMark(p.date_ok)} · {t("pf.operation")} {p.read_operation ?? "—"}{p.duplicate_id ? " ✖" : ""}{p.read_beneficiary ? ` · ${t("pf.beneficiary")} ${p.read_beneficiary}` : ""}{p.read_bank ? ` · ${t("pf.bank")} ${p.read_bank}` : ""}
        </Text>}
        <Button title={"🧾 " + t("pf.view")} variant="secondary" onPress={() => void view(p.proof_path)} />
        <Button title={t("pf.confirm")} disabled={busy} onPress={() => Alert.alert(t("pf.confirm"), t("pf.confirm_q"), [
          { text: t("common.cancel"), style: "cancel" }, { text: t("pf.confirm"), onPress: () => void run(p, true, null) }])} />
        {!(key in reason) && <Button title={t("pf.reject")} variant="danger" disabled={busy} onPress={() => setReason(r => ({ ...r, [key]: "" }))} />}
        {key in reason && <ReasonInput value={reason[key]} placeholder={t("pf.reason_q")} onChange={v => setReason(r => ({ ...r, [key]: v }))}
          onSubmit={() => { if (reason[key]?.trim()) void run(p, false, reason[key]); }} label={t("pf.reject")} />}
      </View>;
    })}
  </View>;
}

/** Android não tem Alert.prompt: o motivo da recusa escreve-se aqui. */
function ReasonInput({ value, placeholder, onChange, onSubmit, label }: { value: string; placeholder: string; onChange: (v: string) => void; onSubmit: () => void; label: string }) {
  return <View style={{ gap: 6 }}>
    <TextInput style={ui.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.muted} accessibilityLabel={placeholder} multiline />
    <Button title={label} variant="danger" disabled={!value.trim()} onPress={onSubmit} />
  </View>;
}
