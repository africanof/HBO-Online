import { useEffect, useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { fillFromPhoto, smartSearch, askHelp, translateListing, priceHint, suggestTeamReply, summarizeDispute, listAiFlags, dismissAiFlag, moderateListing,
  aiMessage, formatPrice, friendlyErrorIn, type CategoryRef, type PhotoFill, type SmartSearch, type PriceHint, type HelpTurn, type AiFlag } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { formatDateTimeIn, useT } from "../lib/i18n";
import { ui, C } from "../lib/ui";
import { Button, Message } from "./Ui";

/** «📷 Preencher pela foto»: a IA propõe título, descrição, categoria e campos a partir da 1.ª fotografia. */
export function PhotoFillButton({ photoUri, categories, onApply }: { photoUri: string | null; categories: CategoryRef[]; onApply: (f: PhotoFill) => void }) {
  const { t, tc } = useT();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  async function run() {
    if (!photoUri) { setErr(t("ai.fill.need_photo")); return; }
    setBusy(true); setErr(""); setOk("");
    try {
      // 1024 px em JPEG: menos dados e mais barato.
      const small = await manipulateAsync(photoUri, [{ resize: { width: 1024 } }], { compress: 0.75, format: SaveFormat.JPEG, base64: true });
      const r = await fillFromPhoto(supabase(), small.base64 ?? "", "image/jpeg", categories);
      if (r.error || !r.data) { setErr(tc(aiMessage(r.error))); return; }
      if (!r.data.found) { setErr(t("ai.fill.not_found")); return; }
      onApply(r.data); setOk(t("ai.fill.done", { n: r.data.remaining }));
    } catch { setErr(tc(aiMessage("INVALID_IMAGE"))); } finally { setBusy(false); }
  }
  return <View style={{ gap: 6 }}>
    <Button title={busy ? t("ai.fill.working") : t("ai.fill.button")} variant="secondary" disabled={busy} onPress={() => void run()} />
    <Text style={ui.muted}>{t("ai.fill.hint")}</Text>
    <Message error={err} ok={ok} />
  </View>;
}

/** «💡 Anúncios parecidos custam…» (sem IA: preços dos últimos 6 meses). */
export function PriceHintNote({ categoryId, listingType, purpose }: { categoryId?: string | null; listingType: string; purpose: string }) {
  const { t } = useT();
  const [hint, setHint] = useState<PriceHint | null>(null);
  useEffect(() => { let on = true; void priceHint(supabase(), categoryId, listingType, purpose).then(h => { if (on) setHint(h); }); return () => { on = false; }; }, [categoryId, listingType, purpose]);
  if (!hint) return null;
  return <Text style={ui.muted}>{t("ai.price.hint", { low: formatPrice(hint.low), high: formatPrice(hint.high), median: formatPrice(hint.median), n: hint.samples })}</Text>;
}

/** «✨ Pesquisa inteligente»: «carro diesel até 5 milhões» → filtros. */
export function SmartSearchButton({ categories, onApply }: { categories: CategoryRef[]; onApply: (s: SmartSearch) => void }) {
  const { t, tc } = useT();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  async function run() {
    setBusy(true); setErr(""); setOk("");
    const r = await smartSearch(supabase(), text, categories); setBusy(false);
    if (r.error || !r.data) { setErr(tc(aiMessage(r.error))); return; }
    onApply(r.data); setOk(t("ai.search.done"));
  }
  return <View style={[ui.card, { gap: 6 }]}>
    <TextInput style={ui.input} value={text} onChangeText={setText} maxLength={300} placeholder={t("ai.search.hint")} placeholderTextColor={C.muted}
      accessibilityLabel={t("ai.search.button")} onSubmitEditing={() => void run()} returnKeyType="search" />
    <Button title={busy ? t("ai.search.working") : t("ai.search.button")} variant="secondary" disabled={busy || text.trim().length < 2} onPress={() => void run()} />
    <Message error={err} ok={ok} />
  </View>;
}

/** «🌐 Traduzir»: só aparece quando a APP está em inglês ou chinês. */
export function TranslateListing({ listingId, onTranslated }: { listingId: string; onTranslated: (v: { title: string; description: string | null } | null) => void }) {
  const { lang, t, tc } = useT();
  const [busy, setBusy] = useState(false); const [on, setOn] = useState(false); const [err, setErr] = useState("");
  if (lang === "pt") return null;
  async function run() {
    if (on) { onTranslated(null); setOn(false); return; }
    setBusy(true); setErr("");
    const r = await translateListing(supabase(), listingId, lang); setBusy(false);
    if (r.error || !r.data) { setErr(tc(aiMessage(r.error))); return; }
    onTranslated(r.data); setOn(true);
  }
  return <View style={{ gap: 4 }}>
    <Button title={busy ? t("ai.tr.working") : on ? t("ai.tr.original") : t("ai.tr.button")} variant="secondary" disabled={busy} onPress={() => void run()} />
    {on && <Text style={ui.muted}>{t("ai.tr.note")}</Text>}
    <Message error={err} />
  </View>;
}

/** Assistente da Ajuda: responde com base na Ajuda, nos Termos e na Privacidade. */
export function HelpAssistant() {
  const router = useRouter(); const { lang, t, tc } = useT();
  const [q, setQ] = useState(""); const [turns, setTurns] = useState<HelpTurn[]>([]); const [handoff, setHandoff] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => { void supabase().auth.getSession().then(({ data }) => setSignedIn(!!data.session)); }, []);
  async function ask() {
    const question = q.trim(); if (question.length < 2) return;
    setBusy(true); setErr("");
    const r = await askHelp(supabase(), question, lang, turns); setBusy(false);
    if (r.error || !r.data) { setErr(tc(aiMessage(r.error))); return; }
    setTurns(x => [...x, { role: "user" as const, content: question }, { role: "assistant" as const, content: r.data!.answer || t("ai.help.handoff") }].slice(-12));
    setHandoff(r.data.handoff); setQ("");
  }
  return <View style={[ui.card, { gap: 8 }]}>
    <Text style={ui.h2}>{t("ai.help.title")}</Text>
    {signedIn === false ? <Button title={t("ai.help.login")} variant="secondary" onPress={() => router.push("/login")} /> : <>
      {turns.map((m, i) => <Text key={i} style={[ui.text, { padding: 10, borderRadius: 10, borderWidth: 1, borderColor: C.line, backgroundColor: m.role === "user" ? C.blueSoft : C.card }]}>
        {m.role === "user" ? "🙂 " : "🤖 "}{m.content}</Text>)}
      {handoff && <Button title={"💬 " + t("ai.help.handoff")} variant="secondary" onPress={() => router.push("/mensagens")} />}
      <TextInput style={ui.input} value={q} onChangeText={setQ} maxLength={600} placeholder={t("ai.help.ph")} placeholderTextColor={C.muted} accessibilityLabel={t("ai.help.title")}
        onSubmitEditing={() => void ask()} returnKeyType="send" />
      <Button title={busy ? "…" : t("ai.help.ask")} disabled={busy || q.trim().length < 2} onPress={() => void ask()} />
      <Message error={err} />
      <Text style={ui.muted}>{t("ai.help.note")}</Text>
    </>}
  </View>;
}

/** Equipa: «🤖 Sugerir resposta» numa conversa mediada (o texto fica para rever antes de enviar). */
export function TeamReplySuggest({ conversationId, audienceId, subject, onUse }: { conversationId: string; audienceId: string; subject?: string | null; onUse: (text: string) => void }) {
  const { t, tc } = useT();
  const [busy, setBusy] = useState(false); const [note, setNote] = useState(""); const [err, setErr] = useState("");
  async function run() {
    setBusy(true); setErr(""); setNote("");
    const r = await suggestTeamReply(supabase(), conversationId, audienceId, subject); setBusy(false);
    if (r.error || !r.data) { setErr(tc(aiMessage(r.error))); return; }
    onUse(r.data.reply); setNote(r.data.note);
  }
  return <View style={{ gap: 4 }}>
    <Button title={busy ? t("ai.staff.working") : t("ai.staff.suggest")} variant="secondary" disabled={busy || !audienceId} onPress={() => void run()} />
    {!audienceId && <Text style={ui.muted}>{t("ai.staff.pick_person")}</Text>}
    {!!note && <Text style={ui.muted}>🤖 {t("ai.staff.note")}: {note}</Text>}
    <Message error={err} />
  </View>;
}

/** Equipa: «🤖 Resumir com IA» uma disputa antes de decidir. */
export function DisputeSummary({ disputeId }: { disputeId: string }) {
  const { t, tc } = useT();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [s, setS] = useState<{ summary: string; points: string[]; missing: string } | null>(null);
  async function run() {
    setBusy(true); setErr("");
    const r = await summarizeDispute(supabase(), disputeId); setBusy(false);
    if (r.error || !r.data) { setErr(tc(aiMessage(r.error))); return; }
    setS(r.data);
  }
  return <View style={{ gap: 6 }}>
    {!s && <Button title={busy ? t("ai.dispute.working") : t("ai.dispute.summary")} variant="secondary" disabled={busy} onPress={() => void run()} />}
    {s && <View style={{ gap: 4, padding: 10, borderRadius: 10, borderWidth: 1, borderStyle: "dashed", borderColor: C.line }}>
      <Text style={[ui.text, { fontWeight: "700" }]}>🤖 {t("ai.dispute.title")}</Text>
      <Text style={ui.text}>{s.summary}</Text>
      {s.points.length > 0 && <><Text style={[ui.text, { fontWeight: "700" }]}>{t("ai.dispute.points")}</Text>{s.points.map((p, i) => <Text key={i} style={ui.text}>• {p}</Text>)}</>}
      {!!s.missing && <Text style={ui.text}>{t("ai.dispute.missing")}: {s.missing}</Text>}
      <Text style={ui.muted}>{t("ai.dispute.note")}</Text>
    </View>}
    <Message error={err} />
  </View>;
}

/** Equipa: anúncios que a IA assinalou (burla provável, contactos escondidos, categoria errada…). */
export function AdminAiFlags() {
  const router = useRouter(); const { lang, t } = useT();
  const [list, setList] = useState<AiFlag[]>([]); const [err, setErr] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);
  async function load() { const r = await listAiFlags(supabase()); if (r.error) setErr(friendlyErrorIn(r.error, lang)); else setList(r.data); }
  useEffect(() => { void load(); }, []);
  async function run(fn: () => PromiseLike<{ error: any }>, message: string) {
    setBusy(true); setErr(""); setOk("");
    const r = await fn(); setBusy(false);
    if (r.error) { setErr(friendlyErrorIn(r.error, lang)); return; }
    setOk(message); await load();
  }
  return <View style={[ui.card, { gap: 10 }]}>
    <Text style={ui.h2}>{t("ai.flags.title")}</Text>
    <Text style={ui.text}>{t("ai.flags.intro")}</Text>
    <Message error={err} ok={ok} />
    {!list.length && <Text style={ui.muted}>{t("ai.flags.none")}</Text>}
    {list.map(f => <View key={f.listing_id} style={[ui.card, { borderLeftWidth: 4, borderLeftColor: f.risk === "high" ? "#C62828" : "#E5A800", gap: 6 }]}>
      <Text style={ui.muted}>{f.risk === "high" ? "🔴 " + t("ai.flags.high") : "🟡 " + t("ai.flags.attention")} · {formatDateTimeIn(f.checked_at, lang)}{f.ref_no ? ` · A-${f.ref_no}` : ""}</Text>
      <Text style={ui.h2}>{f.title}</Text>
      <Text style={ui.text}>{f.owner_name ?? "—"}{f.price != null ? " · " + formatPrice(f.price) : ""}</Text>
      {!!f.summary && <Text style={ui.text}>🤖 {f.summary}</Text>}
      {f.reasons.map((r, i) => <Text key={i} style={ui.text}>• {r}</Text>)}
      {!!f.suggested_category && <Text style={ui.muted}>{t("ai.flags.suggested")}: {f.suggested_category}</Text>}
      <Button title={t("ai.flags.open")} variant="secondary" onPress={() => router.push(`/classificados/${f.listing_id}`)} />
      <Button title={"✔ " + t("ai.flags.dismiss")} variant="secondary" disabled={busy} onPress={() => void run(() => dismissAiFlag(supabase(), f.listing_id), t("ai.flags.ok_dismissed"))} />
      {f.status === "published" && <Button title={t("ai.flags.hide")} variant="danger" disabled={busy} onPress={() => Alert.alert(t("ai.flags.hide"), t("ai.flags.confirm_hide"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("ai.flags.hide"), style: "destructive", onPress: () => void run(async () => { const a = await moderateListing(supabase(), f.listing_id, "cancelled"); return a.error ? a : dismissAiFlag(supabase(), f.listing_id); }, t("ai.flags.ok_hidden")) }])} />}
    </View>)}
  </View>;
}
