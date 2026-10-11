import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { submitReport, validateReport, getTrustSignals, trustBadges, replyToReview, friendlyError, REPORT_REASONS, type ReportTargetType, type TrustSignals } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { VerifiedTag } from "./Reputation";

/** Botão «Denunciar» para perfis, empresas, profissionais e produtos. */
export function ReportButton({ type, id, label = "Denunciar" }: { type: ReportTargetType; id: string; label?: string }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(""); const [details, setDetails] = useState("");
  const [error, setError] = useState(""); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  async function send() {
    if (!(await currentUserId())) { setError("Inicie sessão para denunciar."); return; }
    const v = validateReport(reason); if (v) { setError(v); return; }
    setBusy(true); setError("");
    const r = await submitReport(supabase(), type, id, reason, details); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setDone(true); setOpen(false); }
  }
  if (done) return <Text style={ui.ok}>Denúncia enviada. Obrigado — a administração vai analisar.</Text>;
  if (!open) return <Button title={"🚩 " + label} variant="secondary" onPress={() => setOpen(true)} />;
  return <View style={[ui.card, { backgroundColor: C.surface }]}>
    <Text style={ui.label}>Porque quer denunciar?</Text>
    <Chips options={REPORT_REASONS.map(r => ({ value: r, label: r }))} value={reason} onChange={setReason} />
    <TextInput style={[ui.input, ui.area]} multiline value={details} onChangeText={setDetails} placeholder="Explique o que aconteceu (opcional)" />
    <Message error={error} />
    <Button title="Enviar denúncia" variant="danger" disabled={busy} onPress={() => void send()} />
    <Button title="Cancelar" variant="secondary" onPress={() => setOpen(false)} />
  </View>;
}

/** Selos «✔ Identidade verificada», «✔ Empresa verificada»… */
export function TrustBadges({ userId }: { userId?: string | null }) {
  const [t, setT] = useState<TrustSignals | null>(null);
  useEffect(() => { if (userId) void getTrustSignals(supabase(), userId).then(r => setT(r.data)); }, [userId]);
  const list = trustBadges(t);
  return list.length ? <View style={ui.row}>{list.map(b => <VerifiedTag key={b} text={b} />)}</View> : null;
}

/** Resposta do dono a uma avaliação. */
export function ReviewReply({ kind, reviewId, reply, canReply, onDone }: { kind: "service" | "deal"; reviewId: string; reply?: string | null; canReply: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false); const [text, setText] = useState(reply ?? ""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setError("");
    const r = await replyToReview(supabase(), kind, reviewId, text); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setOpen(false); onDone(); }
  }
  return <>
    {!!reply && !open && <View style={{ borderLeftWidth: 4, borderLeftColor: C.blue, backgroundColor: C.surface, padding: 10, borderRadius: 6 }}><Text style={ui.text}><Text style={ui.label}>Resposta: </Text>{reply}</Text></View>}
    {canReply && !open && <Button title={reply ? "Editar resposta" : "↩ Responder"} variant="secondary" onPress={() => setOpen(true)} />}
    {open && <>
      <TextInput style={[ui.input, ui.area]} multiline value={text} onChangeText={setText} placeholder="Escreva a sua resposta (fica pública)" />
      <Message error={error} />
      <Button title="Publicar resposta" disabled={busy} onPress={() => void save()} />
      <Button title="Cancelar" variant="secondary" onPress={() => setOpen(false)} />
    </>}
  </>;
}
