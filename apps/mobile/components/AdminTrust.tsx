import { useEffect, useState } from "react";
import { Image, Linking, Modal, Pressable, Text, TextInput, View } from "react-native";
import { listVerificationsForAdminV2, decideVerification, verificationDocumentUrl, listAudit, auditLabel, friendlyErrorIn, biNumberText,
  IDENTITY_ADMIN_CHECKLIST, IDENTITY_REJECT_REASONS, VERIFICATION_KIND_LABELS, VERIFICATION_STATUS_LABELS,
  type AdminVerificationV2, type AuditEntry, type VerificationStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { formatDateTimeIn, formatDayIn, useT } from "../lib/i18n";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";

function Check({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onPress} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", minHeight: 48 }}>
    <Text style={{ fontSize: 26, color: C.ink }}>{on ? "☑" : "☐"}</Text><Text style={[ui.text, { flex: 1 }]}>{label}</Text>
  </Pressable>;
}

/** Fotografias privadas do pedido (ligações temporárias); tocar abre em grande. */
function IdentityPhotos({ v }: { v: AdminVerificationV2 }) {
  const { t } = useT();
  const shots = [{ label: t("ad.bi_front"), path: v.document_path }, { label: t("ad.bi_back"), path: v.back_path }, { label: t("ad.selfie"), path: v.selfie_path }]
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
        return <Pressable key={s.path} accessibilityRole="imagebutton" accessibilityLabel={t("ad.view_big", { label: s.label })} disabled={!url} onPress={() => url && setBig({ label: s.label, url })}
          style={{ width: "31%", minWidth: 96, flexGrow: 1, gap: 4 }}>
          <View style={{ height: 130, borderRadius: 10, backgroundColor: "#000", overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
            {url ? <Image source={{ uri: url }} resizeMode="cover" style={{ width: "100%", height: "100%" }} /> : <Text style={{ color: "#fff" }}>{url === null ? t("ad.no_access") : t("common.loading")}</Text>}
          </View>
          <Text style={ui.muted}>{s.label}</Text>
        </Pressable>;
      })}
    </View>
    <Text style={ui.muted}>{t("ad.tap_photo")}</Text>
    <Modal visible={!!big} animationType="fade" onRequestClose={() => setBig(null)}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {!!big && <Image source={{ uri: big.url }} resizeMode="contain" style={{ flex: 1 }} accessibilityLabel={big.label} />}
        <View style={{ padding: 16, gap: 10, backgroundColor: C.surface }}>
          <Text style={ui.label}>{big?.label}</Text>
          <Button title={t("common.close")} variant="secondary" onPress={() => setBig(null)} />
        </View>
      </View>
    </Modal>
  </>;
}

function VerificationCard({ v, onDone, onError }: { v: AdminVerificationV2; onDone: (msg: string) => void; onError: (msg: string) => void }) {
  const { lang, t, tc } = useT();
  const isV2 = v.kind === "identity" && !!v.selfie_path;
  const [checks, setChecks] = useState<boolean[]>(IDENTITY_ADMIN_CHECKLIST.map(() => false));
  const [reason, setReason] = useState(""); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  const allChecked = !isV2 || checks.every(Boolean);
  async function open(path: string) {
    const r = await verificationDocumentUrl(supabase(), path);
    if (r.error || !r.data) onError(friendlyErrorIn(r.error, lang, t("ad.open_doc_failed"))); else void Linking.openURL(r.data);
  }
  async function decide(approve: boolean) {
    const text = approve ? note : [reason, note.trim()].filter(Boolean).join(" — ");
    if (!approve && !text.trim()) { onError(t("ad.need_reason")); return; }
    if (approve && !allChecked) { onError(t("ad.need_checks")); return; }
    setBusy(true);
    try {
      const r = await decideVerification(supabase(), v.id, approve, text);
      if (r.error) onError(friendlyErrorIn(r.error, lang)); else onDone(approve ? t("ad.ok.verif_approved") : t("ad.ok.verif_rejected"));
    } finally { setBusy(false); }
  }
  return <View style={ui.card}>
    <Text style={ui.h2}>{tc(VERIFICATION_KIND_LABELS[v.kind])}{v.business_name ? " — " + v.business_name : ""}</Text>
    <Text style={ui.label}>{tc(VERIFICATION_STATUS_LABELS[v.status])}</Text>
    <Text style={ui.text}>👤 {v.user_name}{v.phone ? " · 📞 " + v.phone : ""}</Text>
    {!!v.account_created_at && <Text style={ui.muted}>{t("ad.account_created", { date: formatDayIn(Date.parse(v.account_created_at), lang) })}</Text>}
    <Text style={ui.muted}>{t("ad.request_of", { date: formatDateTimeIn(v.created_at, lang) })}</Text>
    {v.kind === "identity" && !!v.id_number && <Text style={[ui.h2, { letterSpacing: 1 }]} selectable>{t("ad.bi_number", { n: biNumberText(v.id_number) })}</Text>}
    {v.previous_rejections > 0 && <Text style={ui.error}>{t(v.previous_rejections === 1 ? "ad.prev_rejections_one" : "ad.prev_rejections_many", { n: v.previous_rejections })}</Text>}
    {!!v.note && <Text style={ui.text}>{t("ad.note", { note: v.note })}</Text>}
    {!!v.admin_note && <Text style={ui.text}>{t("ad.answer", { note: v.admin_note })}</Text>}
    {isV2 ? <IdentityPhotos v={v} /> : <Button title={t("ad.view_doc")} variant="secondary" onPress={() => void open(v.document_path)} />}
    {v.status === "pending" && <>
      {isV2 && <View style={{ gap: 4 }}>
        <Text style={ui.label}>{t("ad.confirm_before")}</Text>
        {IDENTITY_ADMIN_CHECKLIST.map((c, i) => <Check key={i} on={checks[i]} label={tc(c)} onPress={() => setChecks(x => x.map((on, j) => j === i ? !on : on))} />)}
      </View>}
      <Button title={busy ? t("ad.wait") : t("ad.approve_btn")} disabled={busy || !allChecked} onPress={() => void decide(true)} />
      {!allChecked && <Text style={ui.muted}>{t("ad.check_all_hint")}</Text>}
      <Text style={ui.label}>{t("ad.reject_reason_label")}</Text>
      {v.kind === "identity" && <Chips options={IDENTITY_REJECT_REASONS.map(r => ({ value: r, label: tc(r) }))} value={reason} onChange={r => setReason(x => x === r ? "" : r)} />}
      <TextInput style={ui.input} value={note} onChangeText={setNote} placeholder={v.kind === "identity" ? t("ad.more_info_opt") : t("ad.reject_reason_ph")} />
      <Button title={t("ad.reject_btn")} variant="danger" disabled={busy} onPress={() => void decide(false)} />
    </>}
  </View>;
}

/** Pedidos de verificação: ver os documentos (ligações temporárias) e aprovar ou recusar. */
export function AdminVerifications() {
  const { lang, t, tc } = useT();
  const [status, setStatus] = useState<VerificationStatus | "">("pending");
  const [items, setItems] = useState<AdminVerificationV2[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listVerificationsForAdminV2(supabase(), status); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void load(); }, [status]);
  return <View style={{ gap: 12 }}>
    <Chips options={[{ value: "" as const, label: t("ad.all_m") }, ...Object.entries(VERIFICATION_STATUS_LABELS).map(([value, label]) => ({ value: value as VerificationStatus, label: tc(label) }))]} value={status} onChange={setStatus} />
    <Message error={error} ok={notice} />
    {items.length === 0 && <Text style={ui.text}>{t("ad.no_verifs")}</Text>}
    {items.map(v => <VerificationCard key={v.id} v={v} onError={m => { setNotice(""); setError(m); }} onDone={m => { setError(""); setNotice(m); void load(); }} />)}
  </View>;
}

/** Registo das ações da administração (só leitura). */
export function AdminAudit() {
  const { lang, t, tc } = useT();
  const [items, setItems] = useState<AuditEntry[]>([]); const [error, setError] = useState("");
  useEffect(() => { void listAudit(supabase(), 200).then(r => { if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }); }, []);
  return <View style={{ gap: 10 }}>
    <Text style={ui.text}>{t("ad.audit_intro")}</Text>
    <Message error={error} />
    {items.length === 0 && !error && <Text style={ui.text}>{t("ad.no_audit")}</Text>}
    {items.map(e => <View key={e.id} style={ui.card}><Text style={ui.label}>{tc(auditLabel(e))}</Text><Text style={ui.muted}>{e.actor_name} · {formatDateTimeIn(e.created_at, lang)}</Text></View>)}
  </View>;
}
