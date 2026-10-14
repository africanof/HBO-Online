import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { inspectedMap, inspectionBadgeText, isInspected, requestInspection, cancelInspection, myInspections, listInspectionsForAdmin, scheduleInspection,
  decideInspection, revokeInspection, hasStore, getProvider, listMyBusinesses, getPlatformSettings, updatePlatformSettings, friendlyError, inspectionRef, scheduledText,
  INSPECTION_BADGE, INSPECTION_EXPLAINED, INSPECTION_KIND_LABELS, INSPECTION_STATUS_LABELS, INSPECTION_CHECKLIST,
  type InspectedInfo, type InspectionKind, type InspectionStatus, type MyInspection, type AdminInspection, type PlatformSettings } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";

const ph = { placeholderTextColor: C.muted };
const Field = ({ label, ...p }: { label: string } & React.ComponentProps<typeof TextInput>) =>
  <View style={{ gap: 4 }}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} style={ui.input} {...ph} {...p} /></View>;

/** 🏅 Selo «Inspecionado» (só aparece se estiver válido). */
export function InspectedBadge({ info, big }: { info?: InspectedInfo | null; big?: boolean }) {
  if (!isInspected(info)) return null;
  const pill = <Text style={{ alignSelf: "flex-start", color: C.greenText, backgroundColor: C.greenSoft, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 2, fontWeight: "800" }}>{INSPECTION_BADGE}</Text>;
  return big ? <View style={[ui.card, { gap: 4, borderColor: C.green }]}>{pill}<Text style={ui.text}>{INSPECTION_EXPLAINED}</Text><Text style={ui.muted}>{inspectionBadgeText(info)}</Text></View> : pill;
}
export function useInspected(kind: InspectionKind, ids: (string | null | undefined)[]) {
  const [map, setMap] = useState<Record<string, InspectedInfo>>({});
  const key = ids.filter(Boolean).join(",");
  useEffect(() => { if (key) void inspectedMap(supabase(), kind, ids).then(setMap); }, [kind, key]);
  return map;
}

type Target = { kind: InspectionKind; id: string; name: string };
const KINDS: InspectionKind[] = ["provider", "business", "store"];

export function MyInspectionsScreen() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [targets, setTargets] = useState<Target[] | null>(null);
  const [items, setItems] = useState<MyInspection[]>([]); const [badges, setBadges] = useState<Record<string, InspectedInfo>>({});
  const [open, setOpen] = useState<string | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load(u: string) {
    const c = supabase();
    const [p, b, s, m] = await Promise.all([getProvider(c, u), listMyBusinesses(c, u), hasStore(c, u), myInspections(c)]);
    const t: Target[] = [];
    if (p.data) t.push({ kind: "provider", id: u, name: (p.data as any).display_name });
    for (const x of (b.data ?? []) as any[]) t.push({ kind: "business", id: x.id, name: x.name });
    if (s) t.push({ kind: "store", id: u, name: "A minha loja" });
    setTargets(t); setItems(m.data);
    const maps = await Promise.all(KINDS.map(k => inspectedMap(c, k, t.filter(x => x.kind === k).map(x => x.id))));
    setBadges(Object.fromEntries(t.map(x => [x.kind + x.id, maps[KINDS.indexOf(x.kind)][x.id]]).filter(([, v]) => v)));
  }
  useFocusEffect(useCallback(() => { void currentUserId().then(u => { setUid(u); if (u) void load(u); }); }, []));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>🏅 Selo «Inspecionado»</Text><Button title="Entrar" onPress={() => router.push("/login")} /></ScrollView>;
  async function cancel(i: MyInspection) { const r = await cancelInspection(supabase(), i.id); if (r.error) setError(friendlyError(r.error)); else { setNotice("Pedido cancelado."); void load(uid!); } }
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Text style={ui.h1}>🏅 Selo «Inspecionado»</Text>
    <Text style={ui.text}>{INSPECTION_EXPLAINED} Os clientes confiam mais em quem tem o selo. O selo vale um ano; depois pode pedir nova visita.</Text>
    <Text style={ui.muted}>Diferente do ✔ (documento verificado): aqui alguém da administração vai mesmo ao local.</Text>
    <Message error={error} ok={notice} />
    {targets === null ? <Text style={ui.text}>A carregar…</Text> : targets.length === 0 ? <Text style={ui.text}>Primeiro crie um perfil profissional, uma empresa ou fábrica, ou ponha produtos na sua loja.</Text> :
      targets.map(t => { const k = t.kind + t.id; const last = items.find(i => i.kind === t.kind && i.target_id === t.id); const busy = !!last && (last.status === "requested" || last.status === "scheduled");
        return <View key={k} style={ui.card}>
          <Text style={ui.h2}>{INSPECTION_KIND_LABELS[t.kind]} · {t.name}</Text>
          <InspectedBadge info={badges[k]} big />
          {!!last && <Text style={ui.text}>{inspectionRef(last.ref_no)} · {INSPECTION_STATUS_LABELS[last.status]}{last.status === "scheduled" && last.scheduled_for ? " — " + scheduledText(last.scheduled_for) : ""}</Text>}
          {!!last?.admin_note && (last.status === "rejected" || last.status === "revoked" || last.status === "scheduled") && <Text style={last.status === "scheduled" ? ui.text : ui.error}>Nota da administração: {last.admin_note}</Text>}
          {busy ? <Button title="Cancelar pedido" variant="secondary" onPress={() => Alert.alert("Cancelar o pedido de inspeção?", "", [{ text: "Não", style: "cancel" }, { text: "Cancelar", onPress: () => void cancel(last!) }])} />
            : open === k ? <RequestForm t={t} onDone={m => { setOpen(null); setNotice(m); setError(""); void load(uid!); }} onClose={() => setOpen(null)} />
            : <Button title={badges[k] ? "🔁 Pedir nova inspeção" : "🏅 Pedir inspeção"} onPress={() => setOpen(k)} />}
        </View>; })}
  </ScrollView>;
}
function RequestForm({ t, onDone, onClose }: { t: Target; onDone: (m: string) => void; onClose: () => void }) {
  const [address, setAddress] = useState(""); const [phone, setPhone] = useState(""); const [when, setWhen] = useState(""); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function send() {
    setBusy(true); setError("");
    const r = await requestInspection(supabase(), t.kind, t.id, { address, phone, preferredTime: when, note }); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else onDone("Pedido enviado. A administração vai ligar para marcar a visita.");
  }
  return <View style={{ gap: 8 }}>
    <Field label="Morada e ponto de referência do local" value={address} onChangeText={setAddress} maxLength={300} multiline placeholder="Ex.: Bairro São João, rua da escola, portão verde" />
    <Field label="Telefone para combinar a visita" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} />
    <Field label="Melhor dia/hora (opcional)" value={when} onChangeText={setWhen} maxLength={120} placeholder="Ex.: dias úteis de manhã" />
    <Field label="Nota (opcional)" value={note} onChangeText={setNote} maxLength={500} />
    <Message error={error} />
    <Button title={busy ? "A enviar…" : "✅ Enviar pedido"} disabled={busy} onPress={() => void send()} />
    <Button title="Cancelar" variant="secondary" onPress={onClose} />
  </View>;
}

export function AdminInspections() {
  const router = useRouter();
  const [status, setStatus] = useState<InspectionStatus | "all">("requested"); const [items, setItems] = useState<AdminInspection[]>([]); const [s, setS] = useState<PlatformSettings | null>(null);
  const [open, setOpen] = useState<string | null>(null); const [note, setNote] = useState(""); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const [a, b] = await Promise.all([listInspectionsForAdmin(supabase(), status === "all" ? "" : status), getPlatformSettings(supabase())]);
    if (a.error) setError(friendlyError(a.error)); setItems(a.data); setS(b.data);
  }
  useEffect(() => { void load(); }, [status]);
  const done = (m: string) => { setNotice(m); setError(""); setOpen(null); setNote(""); void load(); };
  async function saveMonths() {
    const m = Number(s?.inspection_valid_months);
    if (!Number.isInteger(m) || m < 1 || m > 60) { setError("Escolha entre 1 e 60 meses."); return; }
    const r = await updatePlatformSettings(supabase(), { inspection_valid_months: m }); if (r.error) setError(friendlyError(r.error)); else done("Regra guardada.");
  }
  return <View style={{ gap: 12 }}>
    <Text style={ui.h2}>🏅 Inspeções no local</Text>
    <Text style={ui.muted}>Vá ao local, confirme que existe e trabalha de verdade, e só depois aprove.</Text>
    <Message error={error} ok={notice} />
    {!!s && <View style={ui.card}><Field label="Meses de validade do selo" value={String(s.inspection_valid_months ?? "")} onChangeText={v => setS({ ...s, inspection_valid_months: Number(v) || 0 })} keyboardType="numeric" />
      <Button title="Guardar" onPress={() => void saveMonths()} /></View>}
    <Chips options={[{ value: "requested" as const, label: "⏳ Pedidos" }, { value: "scheduled" as const, label: "📅 Marcadas" }, { value: "approved" as const, label: "🏅 Com selo" }, { value: "rejected" as const, label: "❌ Recusadas" }, { value: "all" as const, label: "Todas" }]}
      value={status} onChange={v => setStatus(v as InspectionStatus | "all")} />
    {items.length === 0 && <Text style={ui.text}>Nada nesta lista.</Text>}
    {items.map(i => <View key={i.id} style={ui.card}>
      <Text style={ui.label}>{INSPECTION_KIND_LABELS[i.kind]}{i.category_slug === "fabricas" ? " (🏭 fábrica)" : ""} · {i.target_name ?? "—"}</Text>
      <Text style={ui.muted}>{inspectionRef(i.ref_no)} · {INSPECTION_STATUS_LABELS[i.status]} · dono: {i.owner_name}{i.phone ? " · 📞 " + i.phone : ""}</Text>
      {!!i.address && <Text style={ui.text}>📍 {i.address}</Text>}
      {!!i.preferred_time && <Text style={ui.muted}>Preferência: {i.preferred_time}</Text>}
      {!!i.note && <Text style={ui.muted}>Nota: {i.note}</Text>}
      {!!i.scheduled_for && <Text style={ui.text}>📅 Visita: {scheduledText(i.scheduled_for)}{i.inspector_name ? " · " + i.inspector_name : ""}</Text>}
      {!!i.admin_note && <Text style={ui.muted}>Nota da administração: {i.admin_note}</Text>}
      <Button title="👁️ Ver" variant="secondary" onPress={() => router.push((i.kind === "provider" ? "/profissionais/" : i.kind === "business" ? "/empresas/" : "/vendedor/") + i.target_id as any)} />
      {(i.status === "requested" || i.status === "scheduled") && <>
        <Button title="📅 Marcar visita" variant="secondary" onPress={() => setOpen(open === "s" + i.id ? null : "s" + i.id)} />
        <Button title="📝 Resultado da visita" onPress={() => setOpen(open === "d" + i.id ? null : "d" + i.id)} />
      </>}
      {i.status === "approved" && (open === "r" + i.id ? <><TextInput style={[ui.input, ui.area]} multiline value={note} onChangeText={setNote} placeholder="Motivo (o dono vai ler)" accessibilityLabel="Motivo" {...ph} />
        <Button title="⛔ Retirar selo" variant="danger" onPress={async () => { const r = await revokeInspection(supabase(), i.id, note); if (r.error) setError(friendlyError(r.error)); else done("Selo retirado."); }} /></>
        : <Button title="⛔ Retirar selo" variant="secondary" onPress={() => { setOpen("r" + i.id); setNote(""); }} />)}
      {open === "s" + i.id && <ScheduleForm i={i} onDone={done} onError={setError} />}
      {open === "d" + i.id && <DecideForm i={i} onDone={done} onError={setError} />}
    </View>)}
  </View>;
}
function ScheduleForm({ i, onDone, onError }: { i: AdminInspection; onDone: (m: string) => void; onError: (m: string) => void }) {
  const [day, setDay] = useState(""); const [hour, setHour] = useState("09:00"); const [who, setWho] = useState(i.inspector_name ?? ""); const [note, setNote] = useState("");
  async function send() {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(day.trim()); const h = /^(\d{1,2}):(\d{2})$/.exec(hour.trim());
    if (!m || !h) { onError("Escreva o dia (DD/MM/AAAA) e a hora (HH:MM)."); return; }
    const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}T${h[1].padStart(2, "0")}:${h[2]}:00+01:00`;
    const r = await scheduleInspection(supabase(), i.id, iso, who, note); if (r.error) onError(friendlyError(r.error)); else onDone("Visita marcada: o dono foi avisado.");
  }
  return <View style={{ gap: 8 }}>
    <Field label="Dia (DD/MM/AAAA)" value={day} onChangeText={setDay} keyboardType="numbers-and-punctuation" placeholder="20/10/2026" />
    <Field label="Hora (HH:MM)" value={hour} onChangeText={setHour} keyboardType="numbers-and-punctuation" />
    <Field label="Quem vai (opcional)" value={who} onChangeText={setWho} maxLength={80} />
    <Field label="Nota para o dono (opcional)" value={note} onChangeText={setNote} maxLength={500} />
    <Button title="Marcar e avisar" onPress={() => void send()} />
  </View>;
}
function DecideForm({ i, onDone, onError }: { i: AdminInspection; onDone: (m: string) => void; onError: (m: string) => void }) {
  const [check, setCheck] = useState<Record<string, boolean>>({}); const [note, setNote] = useState("");
  async function decide(ok: boolean) { const r = await decideInspection(supabase(), i.id, ok, check, note); if (r.error) onError(friendlyError(r.error)); else onDone(ok ? "Selo dado: já aparece ao público." : "Inspeção recusada: o dono foi avisado."); }
  return <View style={{ gap: 8 }}>
    <Text style={ui.label}>O que confirmou no local?</Text>
    {INSPECTION_CHECKLIST.map(c => <Pressable key={c.key} accessibilityRole="checkbox" accessibilityState={{ checked: !!check[c.key] }} onPress={() => setCheck({ ...check, [c.key]: !check[c.key] })}
      style={{ flexDirection: "row", gap: 10, alignItems: "center", minHeight: 48 }}>
      <Text style={{ fontSize: 24, color: C.ink }}>{check[c.key] ? "☑" : "☐"}</Text><Text style={[ui.text, { flex: 1 }]}>{c.label}{c.required ? " (obrigatório)" : ""}</Text></Pressable>)}
    <Field label="Nota (obrigatória para recusar)" value={note} onChangeText={setNote} maxLength={500} />
    <Button title="🏅 Aprovar e dar o selo" onPress={() => !check.exists ? onError("Só pode aprovar se confirmou que existe mesmo no local.") : Alert.alert("Dar o selo?", `Dar o selo «Inspecionado» a ${i.target_name}?`, [{ text: "Não", style: "cancel" }, { text: "Sim", onPress: () => void decide(true) }])} />
    <Button title="❌ Recusar" variant="secondary" onPress={() => void decide(false)} />
  </View>;
}
