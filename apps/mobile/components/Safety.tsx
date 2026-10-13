import { useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { getSafeSpots, saveSafeSpots, toggleBlock, listMyBlocks, conversationWarnings, friendlyError, SAFETY_TIPS, SCAM_WARNING_TEXT, DEFAULT_SAFE_SPOTS, type SafeSpot } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Message } from "./Ui";
import { ReportButton } from "./Trust";

/** Pontos de encontro seguros (lista da administração). */
export function SafeSpotsList() {
  const [spots, setSpots] = useState<SafeSpot[]>(DEFAULT_SAFE_SPOTS);
  useEffect(() => { void getSafeSpots(supabase()).then(setSpots); }, []);
  return <View style={{ gap: 6 }}>{spots.map(s => <Text key={s.name} style={ui.text}>• <Text style={{ fontWeight: "800" }}>{s.name}</Text>{s.note ? " — " + s.note : ""}</Text>)}</View>;
}

export function TipsList({ tips = SAFETY_TIPS }: { tips?: readonly string[] }) {
  return <View style={{ gap: 6 }}>{tips.map(t => <Text key={t} style={ui.text}>• {t}</Text>)}</View>;
}

/** Abre/fecha um bloco (como <details> no Site). */
function Fold({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <View style={ui.card}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ minHeight: 44, justifyContent: "center" }}>
      <Text style={ui.label}>{open ? "▾ " : "▸ "}{title}</Text>
    </Pressable>
    {open && children}
  </View>;
}

/** Caixa curta de dicas (página do anúncio). */
export function SafetyTipsBox() {
  const router = useRouter();
  return <Fold title="🛡️ Compre e venda em segurança">
    <TipsList tips={SAFETY_TIPS.slice(0, 4)} />
    <Pressable accessibilityRole="link" onPress={() => router.push("/seguranca" as any)}><Text style={ui.link}>Ver pontos de encontro seguros e mais dicas</Text></Pressable>
  </Fold>;
}

/** Aviso amarelo com os sinais de burla da conversa. */
export function ScamWarnings({ messages, uid }: { messages: { sender_id: string; body: string | null }[]; uid: string }) {
  const warnings = conversationWarnings(messages, uid);
  if (!warnings.length) return null;
  return <View accessibilityRole="alert" style={{ backgroundColor: C.yellowSoft, borderColor: C.yellowLine, borderWidth: 2, borderRadius: 16, padding: 12, gap: 6 }}>
    <Text style={{ color: C.yellowText, fontWeight: "800", fontSize: 17 }}>⚠️ Cuidado: esta conversa tem sinais de burla</Text>
    {warnings.map(w => <Text key={w} style={{ color: C.yellowText, fontSize: 16, lineHeight: 22 }}>{SCAM_WARNING_TEXT[w]}</Text>)}
  </View>;
}

/** Na conversa: avisos de burla, dicas, pontos de encontro, Bloquear e Denunciar. */
export function ConversationSafety({ messages, uid, otherUserId, otherName }: { messages: { sender_id: string; body: string | null }[]; uid: string; otherUserId?: string | null; otherName?: string | null }) {
  const [blocked, setBlocked] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  useEffect(() => {
    setNotice(""); setError("");
    if (!otherUserId) return;
    void listMyBlocks(supabase()).then(r => setBlocked(r.data.some(b => b.user_id === otherUserId)));
  }, [otherUserId]);
  async function run() {
    if (!otherUserId) return;
    setBusy(true); setError("");
    const r = await toggleBlock(supabase(), otherUserId);
    setBusy(false);
    if (r.error) { setError(friendlyError(r.error)); return; }
    setBlocked(!!r.data); setNotice(r.data ? "Pessoa bloqueada. Já não podem trocar mensagens." : "Pessoa desbloqueada.");
  }
  function block() {
    if (blocked) { void run(); return; }
    Alert.alert("Bloquear", `Bloquear ${otherName || "esta pessoa"}? Deixam de poder trocar mensagens.`, [{ text: "Cancelar", style: "cancel" }, { text: "Bloquear", style: "destructive", onPress: () => void run() }]);
  }
  return <View style={{ gap: 10 }}>
    <ScamWarnings messages={messages} uid={uid} />
    {blocked && <Text style={ui.error}>🚫 Bloqueou esta pessoa. Desbloqueie para voltar a trocar mensagens.</Text>}
    <Fold title="🛡️ Dicas de segurança e pontos de encontro">
      <TipsList />
      <Text style={ui.label}>📍 Pontos de encontro seguros</Text>
      <SafeSpotsList />
    </Fold>
    {!!otherUserId && <View style={{ gap: 8 }}>
      <Button title={blocked ? "✅ Desbloquear" : "🚫 Bloquear"} variant={blocked ? "secondary" : "danger"} disabled={busy} onPress={block} />
      <ReportButton type="user" id={otherUserId} label="🚩 Denunciar" />
    </View>}
    <Message error={error} ok={notice} />
  </View>;
}

/** Administração: editar os pontos de encontro seguros. */
export function AdminSafeSpots() {
  const [spots, setSpots] = useState<SafeSpot[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  useEffect(() => { void getSafeSpots(supabase()).then(setSpots); }, []);
  const set = (i: number, k: keyof SafeSpot, v: string) => setSpots(list => list.map((s, j) => j === i ? { ...s, [k]: v } : s));
  async function save() {
    setBusy(true); setError(""); setNotice("");
    const r = await saveSafeSpots(supabase(), spots);
    setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else setNotice("Pontos de encontro guardados.");
  }
  return <View style={[ui.card, { gap: 10 }]}>
    <Text style={ui.h2}>📍 Pontos de encontro seguros</Text>
    <Text style={ui.text}>Aparecem nas mensagens e na página «Segurança». Escreva lugares públicos, movimentados e com câmaras.</Text>
    {spots.map((s, i) => <View key={i} style={[ui.card, { gap: 6 }]}>
      <Text style={ui.label}>Ponto {i + 1} — lugar</Text>
      <TextInput accessibilityLabel={`Ponto ${i + 1}: lugar`} value={s.name} maxLength={120} onChangeText={v => set(i, "name", v)} style={ui.input} />
      <Text style={ui.label}>Nota (opcional)</Text>
      <TextInput accessibilityLabel={`Ponto ${i + 1}: nota`} value={s.note ?? ""} maxLength={200} onChangeText={v => set(i, "note", v)} style={ui.input} />
      <Button title="Tirar este ponto" variant="secondary" onPress={() => setSpots(list => list.filter((_, j) => j !== i))} />
    </View>)}
    <Message error={error} ok={notice} />
    {spots.length < 20 && <Button title="➕ Juntar ponto" variant="secondary" onPress={() => setSpots(list => [...list, { name: "", note: "" }])} />}
    <Button title={busy ? "A guardar…" : "Guardar pontos"} disabled={busy} onPress={() => void save()} />
  </View>;
}
