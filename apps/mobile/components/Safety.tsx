import { useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { getSafeSpots, saveSafeSpots, toggleBlock, listMyBlocks, conversationWarnings, friendlyErrorIn, SAFETY_TIPS, SCAM_WARNING_TEXT, DEFAULT_SAFE_SPOTS, type SafeSpot } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Message } from "./Ui";
import { ReportButton } from "./Trust";
import { useT } from "../lib/i18n";

/** Pontos de encontro seguros (lista da administração). */
export function SafeSpotsList() {
  const { tc } = useT();
  const [spots, setSpots] = useState<SafeSpot[]>(DEFAULT_SAFE_SPOTS);
  useEffect(() => { void getSafeSpots(supabase()).then(setSpots); }, []);
  return <View style={{ gap: 6 }}>{spots.map(s => <Text key={s.name} style={ui.text}>• <Text style={{ fontWeight: "800" }}>{tc(s.name)}</Text>{s.note ? " — " + tc(s.note) : ""}</Text>)}</View>;
}

export function TipsList({ tips = SAFETY_TIPS }: { tips?: readonly string[] }) {
  const { tc } = useT();
  return <View style={{ gap: 6 }}>{tips.map(x => <Text key={x} style={ui.text}>• {tc(x)}</Text>)}</View>;
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
  const router = useRouter(); const { t } = useT();
  return <Fold title={t("ls.safety.box")}>
    <TipsList tips={SAFETY_TIPS.slice(0, 4)} />
    <Pressable accessibilityRole="link" onPress={() => router.push("/seguranca" as any)}><Text style={ui.link}>{t("ls.safety.more")}</Text></Pressable>
  </Fold>;
}

/** Aviso amarelo com os sinais de burla da conversa. */
export function ScamWarnings({ messages, uid }: { messages: { sender_id: string; body: string | null }[]; uid: string }) {
  const { t, tc } = useT();
  const warnings = conversationWarnings(messages, uid);
  if (!warnings.length) return null;
  return <View accessibilityRole="alert" style={{ backgroundColor: C.yellowSoft, borderColor: C.yellowLine, borderWidth: 2, borderRadius: 16, padding: 12, gap: 6 }}>
    <Text style={{ color: C.yellowText, fontWeight: "800", fontSize: 17 }}>{t("ls.safety.scam")}</Text>
    {warnings.map(w => <Text key={w} style={{ color: C.yellowText, fontSize: 16, lineHeight: 22 }}>{tc(SCAM_WARNING_TEXT[w])}</Text>)}
  </View>;
}

/** Na conversa: avisos de burla, dicas, pontos de encontro, Bloquear e Denunciar. */
export function ConversationSafety({ messages, uid, otherUserId, otherName }: { messages: { sender_id: string; body: string | null }[]; uid: string; otherUserId?: string | null; otherName?: string | null }) {
  const { t, lang } = useT();
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
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    setBlocked(!!r.data); setNotice(r.data ? t("ls.safety.blocked") : t("ls.safety.unblocked"));
  }
  function block() {
    if (blocked) { void run(); return; }
    Alert.alert(t("ls.safety.block"), t("ls.safety.block_q", { name: otherName || t("ls.safety.this_person") }), [{ text: t("common.cancel"), style: "cancel" }, { text: t("ls.safety.block"), style: "destructive", onPress: () => void run() }]);
  }
  return <View style={{ gap: 10 }}>
    <ScamWarnings messages={messages} uid={uid} />
    {blocked && <Text style={ui.error}>{t("ls.safety.you_blocked")}</Text>}
    <Fold title={t("ls.safety.fold")}>
      <TipsList />
      <Text style={ui.label}>{t("ls.safety.spots")}</Text>
      <SafeSpotsList />
    </Fold>
    {!!otherUserId && <View style={{ gap: 8 }}>
      <Button title={blocked ? "✅ " + t("ls.safety.unblock") : "🚫 " + t("ls.safety.block")} variant={blocked ? "secondary" : "danger"} disabled={busy} onPress={block} />
      <ReportButton type="user" id={otherUserId} label={t("ls.safety.report")} />
    </View>}
    <Message error={error} ok={notice} />
  </View>;
}

/** Administração: editar os pontos de encontro seguros. */
export function AdminSafeSpots() {
  const { t, lang } = useT();
  const [spots, setSpots] = useState<SafeSpot[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  useEffect(() => { void getSafeSpots(supabase()).then(setSpots); }, []);
  const set = (i: number, k: keyof SafeSpot, v: string) => setSpots(list => list.map((s, j) => j === i ? { ...s, [k]: v } : s));
  async function save() {
    setBusy(true); setError(""); setNotice("");
    const r = await saveSafeSpots(supabase(), spots);
    setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setNotice(t("ls.safety.spots_saved"));
  }
  return <View style={[ui.card, { gap: 10 }]}>
    <Text style={ui.h2}>{t("ls.safety.spots")}</Text>
    <Text style={ui.text}>{t("ls.safety.spots_hint")}</Text>
    {spots.map((s, i) => <View key={i} style={[ui.card, { gap: 6 }]}>
      <Text style={ui.label}>{t("ls.safety.spot_place", { n: i + 1 })}</Text>
      <TextInput accessibilityLabel={t("ls.safety.spot_place_a11y", { n: i + 1 })} value={s.name} maxLength={120} onChangeText={v => set(i, "name", v)} style={ui.input} />
      <Text style={ui.label}>{t("ls.safety.note_opt")}</Text>
      <TextInput accessibilityLabel={t("ls.safety.spot_note_a11y", { n: i + 1 })} value={s.note ?? ""} maxLength={200} onChangeText={v => set(i, "note", v)} style={ui.input} />
      <Button title={t("ls.safety.remove_spot")} variant="secondary" onPress={() => setSpots(list => list.filter((_, j) => j !== i))} />
    </View>)}
    <Message error={error} ok={notice} />
    {spots.length < 20 && <Button title={t("ls.safety.add_spot")} variant="secondary" onPress={() => setSpots(list => [...list, { name: "", note: "" }])} />}
    <Button title={busy ? t("recover.saving") : t("ls.safety.save_spots")} disabled={busy} onPress={() => void save()} />
  </View>;
}
