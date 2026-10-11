import { useEffect, useState } from "react";
import { Linking, Text, TextInput, View } from "react-native";
import { listVerificationsForAdmin, decideVerification, verificationDocumentUrl, listAudit, auditLabel, friendlyError,
  VERIFICATION_KIND_LABELS, VERIFICATION_STATUS_LABELS, type AdminVerification, type AuditEntry, type VerificationStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";

/** Pedidos de verificação: ver o documento (ligação temporária) e aprovar ou recusar. */
export function AdminVerifications() {
  const [status, setStatus] = useState<VerificationStatus | "">("pending");
  const [items, setItems] = useState<AdminVerification[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  async function load() { const r = await listVerificationsForAdmin(supabase(), status); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useEffect(() => { void load(); }, [status]);
  async function open(path: string) {
    const r = await verificationDocumentUrl(supabase(), path);
    if (r.error || !r.data) setError(friendlyError(r.error, "Não foi possível abrir o documento.")); else void Linking.openURL(r.data);
  }
  async function decide(v: AdminVerification, approve: boolean) {
    const note = notes[v.id] ?? "";
    if (!approve && !note.trim()) { setError("Escreva o motivo da recusa."); return; }
    setError(""); setNotice("");
    const r = await decideVerification(supabase(), v.id, approve, note);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(approve ? "Verificação aprovada." : "Verificação recusada."); await load(); }
  }
  return <View style={{ gap: 12 }}>
    <Chips options={[{ value: "" as const, label: "Todos" }, ...Object.entries(VERIFICATION_STATUS_LABELS).map(([value, label]) => ({ value: value as VerificationStatus, label }))]} value={status} onChange={setStatus} />
    <Message error={error} ok={notice} />
    {items.length === 0 && <Text style={ui.text}>Sem pedidos de verificação.</Text>}
    {items.map(v => <View key={v.id} style={ui.card}>
      <Text style={ui.h2}>{VERIFICATION_KIND_LABELS[v.kind]}{v.business_name ? " — " + v.business_name : ""}</Text>
      <Text style={ui.label}>{VERIFICATION_STATUS_LABELS[v.status]}</Text>
      <Text style={ui.text}>{v.user_name}{v.phone ? " · " + v.phone : ""}</Text>
      <Text style={ui.muted}>{new Date(v.created_at).toLocaleString("pt-AO")}</Text>
      {!!v.note && <Text style={ui.text}>Nota: {v.note}</Text>}
      {!!v.admin_note && <Text style={ui.text}>Resposta: {v.admin_note}</Text>}
      <Button title="📄 Ver documento" variant="secondary" onPress={() => void open(v.document_path)} />
      {v.status === "pending" && <>
        <Button title="✔ Aprovar" onPress={() => void decide(v, true)} />
        <TextInput style={ui.input} value={notes[v.id] ?? ""} onChangeText={t => setNotes(n => ({ ...n, [v.id]: t }))} placeholder="Motivo da recusa (a pessoa vai ver)" />
        <Button title="✖ Recusar" variant="danger" onPress={() => void decide(v, false)} />
      </>}
    </View>)}
  </View>;
}

/** Registo das ações da administração (só leitura). */
export function AdminAudit() {
  const [items, setItems] = useState<AuditEntry[]>([]); const [error, setError] = useState("");
  useEffect(() => { void listAudit(supabase(), 200).then(r => { if (r.error) setError(friendlyError(r.error)); setItems(r.data); }); }, []);
  return <View style={{ gap: 10 }}>
    <Text style={ui.text}>Tudo o que a administração muda fica aqui registado.</Text>
    <Message error={error} />
    {items.length === 0 && !error && <Text style={ui.text}>Ainda sem registos.</Text>}
    {items.map(e => <View key={e.id} style={ui.card}><Text style={ui.label}>{auditLabel(e)}</Text><Text style={ui.muted}>{e.actor_name} · {new Date(e.created_at).toLocaleString("pt-AO")}</Text></View>)}
  </View>;
}
