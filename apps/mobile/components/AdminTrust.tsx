import { useEffect, useState } from "react";
import { Image, Linking, Modal, Pressable, Text, TextInput, View } from "react-native";
import { listVerificationsForAdminV2, decideVerification, verificationDocumentUrl, listAudit, auditLabel, friendlyError, biNumberText,
  IDENTITY_ADMIN_CHECKLIST, IDENTITY_REJECT_REASONS, VERIFICATION_KIND_LABELS, VERIFICATION_STATUS_LABELS,
  type AdminVerificationV2, type AuditEntry, type VerificationStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";

function Check({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onPress} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", minHeight: 48 }}>
    <Text style={{ fontSize: 26, color: C.ink }}>{on ? "☑" : "☐"}</Text><Text style={[ui.text, { flex: 1 }]}>{label}</Text>
  </Pressable>;
}

/** Fotografias privadas do pedido (ligações temporárias); tocar abre em grande. */
function IdentityPhotos({ v }: { v: AdminVerificationV2 }) {
  const shots = [{ label: "BI — frente", path: v.document_path }, { label: "BI — verso", path: v.back_path }, { label: "Selfie com o BI", path: v.selfie_path }]
    .filter((x): x is { label: string; path: string } => !!x.path);
  const [urls, setUrls] = useState<Record<string, string | null>>({}); const [big, setBig] = useState<{ label: string; url: string } | null>(null);
  useEffect(() => {
    let alive = true;
    void Promise.all(shots.map(async s => [s.path, (await verificationDocumentUrl(supabase(), s.path)).data] as const))
      .then(list => { if (alive) setUrls(Object.fromEntries(list)); });
    return () => { alive = false; };
  }, [v.id]);
  return <>
    <View style={ui.row}>
      {shots.map(s => {
        const url = urls[s.path];
        return <Pressable key={s.path} accessibilityRole="imagebutton" accessibilityLabel={"Ver em grande: " + s.label} disabled={!url} onPress={() => url && setBig({ label: s.label, url })}
          style={{ width: "31%", minWidth: 96, flexGrow: 1, gap: 4 }}>
          <View style={{ height: 130, borderRadius: 10, backgroundColor: "#000", overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
            {url ? <Image source={{ uri: url }} resizeMode="cover" style={{ width: "100%", height: "100%" }} /> : <Text style={{ color: "#fff" }}>{url === null ? "Sem acesso" : "A carregar…"}</Text>}
          </View>
          <Text style={ui.muted}>{s.label}</Text>
        </Pressable>;
      })}
    </View>
    <Text style={ui.muted}>Toque numa fotografia para a ver em grande.</Text>
    <Modal visible={!!big} animationType="fade" onRequestClose={() => setBig(null)}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {!!big && <Image source={{ uri: big.url }} resizeMode="contain" style={{ flex: 1 }} accessibilityLabel={big.label} />}
        <View style={{ padding: 16, gap: 10, backgroundColor: C.surface }}>
          <Text style={ui.label}>{big?.label}</Text>
          <Button title="Fechar" variant="secondary" onPress={() => setBig(null)} />
        </View>
      </View>
    </Modal>
  </>;
}

function VerificationCard({ v, onDone, onError }: { v: AdminVerificationV2; onDone: (msg: string) => void; onError: (msg: string) => void }) {
  const isV2 = v.kind === "identity" && !!v.selfie_path;
  const [checks, setChecks] = useState<boolean[]>(IDENTITY_ADMIN_CHECKLIST.map(() => false));
  const [reason, setReason] = useState(""); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  const allChecked = !isV2 || checks.every(Boolean);
  async function open(path: string) {
    const r = await verificationDocumentUrl(supabase(), path);
    if (r.error || !r.data) onError(friendlyError(r.error, "Não foi possível abrir o documento.")); else void Linking.openURL(r.data);
  }
  async function decide(approve: boolean) {
    const text = approve ? note : [reason, note.trim()].filter(Boolean).join(" — ");
    if (!approve && !text.trim()) { onError("Escolha ou escreva o motivo da recusa."); return; }
    if (approve && !allChecked) { onError("Confirme todos os pontos da lista antes de aprovar."); return; }
    setBusy(true);
    try {
      const r = await decideVerification(supabase(), v.id, approve, text);
      if (r.error) onError(friendlyError(r.error)); else onDone(approve ? "Verificação aprovada." : "Verificação recusada.");
    } finally { setBusy(false); }
  }
  return <View style={ui.card}>
    <Text style={ui.h2}>{VERIFICATION_KIND_LABELS[v.kind]}{v.business_name ? " — " + v.business_name : ""}</Text>
    <Text style={ui.label}>{VERIFICATION_STATUS_LABELS[v.status]}</Text>
    <Text style={ui.text}>👤 {v.user_name}{v.phone ? " · 📞 " + v.phone : ""}</Text>
    {!!v.account_created_at && <Text style={ui.muted}>Conta criada em {new Date(v.account_created_at).toLocaleDateString("pt-AO")}</Text>}
    <Text style={ui.muted}>Pedido de {new Date(v.created_at).toLocaleString("pt-AO")}</Text>
    {v.kind === "identity" && !!v.id_number && <Text style={[ui.h2, { letterSpacing: 1 }]} selectable>BI n.º {biNumberText(v.id_number)}</Text>}
    {v.previous_rejections > 0 && <Text style={ui.error}>⚠️ Já foi recusado {v.previous_rejections} {v.previous_rejections === 1 ? "vez" : "vezes"} antes.</Text>}
    {!!v.note && <Text style={ui.text}>Nota: {v.note}</Text>}
    {!!v.admin_note && <Text style={ui.text}>Resposta: {v.admin_note}</Text>}
    {isV2 ? <IdentityPhotos v={v} /> : <Button title="📄 Ver documento" variant="secondary" onPress={() => void open(v.document_path)} />}
    {v.status === "pending" && <>
      {isV2 && <View style={{ gap: 4 }}>
        <Text style={ui.label}>Antes de aprovar, confirme:</Text>
        {IDENTITY_ADMIN_CHECKLIST.map((c, i) => <Check key={i} on={checks[i]} label={c} onPress={() => setChecks(x => x.map((on, j) => j === i ? !on : on))} />)}
      </View>}
      <Button title={busy ? "Aguarde…" : "✔ Aprovar"} disabled={busy || !allChecked} onPress={() => void decide(true)} />
      {!allChecked && <Text style={ui.muted}>Marque todos os pontos para poder aprovar.</Text>}
      <Text style={ui.label}>Recusar — motivo (a pessoa vai ver)</Text>
      {v.kind === "identity" && <Chips options={IDENTITY_REJECT_REASONS.map(r => ({ value: r, label: r }))} value={reason} onChange={r => setReason(x => x === r ? "" : r)} />}
      <TextInput style={ui.input} value={note} onChangeText={setNote} placeholder={v.kind === "identity" ? "Mais explicações (opcional)" : "Motivo da recusa"} />
      <Button title="✖ Recusar" variant="danger" disabled={busy} onPress={() => void decide(false)} />
    </>}
  </View>;
}

/** Pedidos de verificação: ver os documentos (ligações temporárias) e aprovar ou recusar. */
export function AdminVerifications() {
  const [status, setStatus] = useState<VerificationStatus | "">("pending");
  const [items, setItems] = useState<AdminVerificationV2[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listVerificationsForAdminV2(supabase(), status); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useEffect(() => { void load(); }, [status]);
  return <View style={{ gap: 12 }}>
    <Chips options={[{ value: "" as const, label: "Todos" }, ...Object.entries(VERIFICATION_STATUS_LABELS).map(([value, label]) => ({ value: value as VerificationStatus, label }))]} value={status} onChange={setStatus} />
    <Message error={error} ok={notice} />
    {items.length === 0 && <Text style={ui.text}>Sem pedidos de verificação.</Text>}
    {items.map(v => <VerificationCard key={v.id} v={v} onError={m => { setNotice(""); setError(m); }} onDone={m => { setError(""); setNotice(m); void load(); }} />)}
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
