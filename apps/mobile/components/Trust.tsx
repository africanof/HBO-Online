import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { submitReport, validateReport, getTrustSignals, trustBadges, replyToReview, friendlyErrorIn, REPORT_REASONS, type ReportTargetType, type TrustSignals } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { VerifiedTag } from "./Reputation";
import { useT } from "../lib/i18n";

/** Botão «Denunciar» para perfis, empresas, profissionais e produtos. */
export function ReportButton({ type, id, label }: { type: ReportTargetType; id: string; label?: string }) {
  const { t, tc, lang } = useT();
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(""); const [details, setDetails] = useState("");
  const [error, setError] = useState(""); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  async function send() {
    if (!(await currentUserId())) { setError(t("sv.report_login")); return; }
    const v = validateReport(reason); if (v) { setError(tc(v)); return; }
    setBusy(true); setError("");
    const r = await submitReport(supabase(), type, id, reason, details); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setDone(true); setOpen(false); }
  }
  if (done) return <Text style={ui.ok}>{t("sv.report_sent")}</Text>;
  if (!open) return <Button title={"🚩 " + (label ?? t("sv.report"))} variant="secondary" onPress={() => setOpen(true)} />;
  return <View style={[ui.card, { backgroundColor: C.surface }]}>
    <Text style={ui.label}>{t("sv.report_why")}</Text>
    <Chips options={REPORT_REASONS.map(r => ({ value: r, label: tc(r) }))} value={reason} onChange={setReason} />
    <TextInput style={[ui.input, ui.area]} multiline value={details} onChangeText={setDetails} placeholder={t("sv.report_details_ph")} />
    <Message error={error} />
    <Button title={t("sv.report_send")} variant="danger" disabled={busy} onPress={() => void send()} />
    <Button title={t("common.cancel")} variant="secondary" onPress={() => setOpen(false)} />
  </View>;
}

/** Selos «✔ Identidade verificada», «✔ Empresa verificada»… */
export function TrustBadges({ userId }: { userId?: string | null }) {
  const { tc } = useT();
  const [t, setT] = useState<TrustSignals | null>(null);
  useEffect(() => { if (userId) void getTrustSignals(supabase(), userId).then(r => setT(r.data)); }, [userId]);
  const list = trustBadges(t);
  return list.length ? <View style={ui.row}>{list.map(b => <VerifiedTag key={b} text={tc(b)} />)}</View> : null;
}

/** Resposta do dono a uma avaliação. */
export function ReviewReply({ kind, reviewId, reply, canReply, onDone }: { kind: "service" | "deal"; reviewId: string; reply?: string | null; canReply: boolean; onDone: () => void }) {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false); const [text, setText] = useState(reply ?? ""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setError("");
    const r = await replyToReview(supabase(), kind, reviewId, text); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setOpen(false); onDone(); }
  }
  return <>
    {!!reply && !open && <View style={{ borderLeftWidth: 4, borderLeftColor: C.blue, backgroundColor: C.surface, padding: 10, borderRadius: 6 }}><Text style={ui.text}><Text style={ui.label}>{t("sv.reply_label")}</Text>{reply}</Text></View>}
    {canReply && !open && <Button title={reply ? t("sv.reply_edit") : t("sv.reply")} variant="secondary" onPress={() => setOpen(true)} />}
    {open && <>
      <TextInput style={[ui.input, ui.area]} multiline value={text} onChangeText={setText} placeholder={t("sv.reply_ph")} />
      <Message error={error} />
      <Button title={t("sv.reply_publish")} disabled={busy} onPress={() => void save()} />
      <Button title={t("common.cancel")} variant="secondary" onPress={() => setOpen(false)} />
    </>}
  </>;
}
