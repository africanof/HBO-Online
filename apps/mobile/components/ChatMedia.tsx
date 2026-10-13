import { useEffect, useState } from "react";
import { Image, Linking, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useAudioRecorder, useAudioRecorderState, useAudioPlayer, useAudioPlayerStatus, requestRecordingPermissionsAsync, setAudioModeAsync, RecordingPresets,
  type RecordingOptions } from "expo-audio";
import { uploadChatFile, sendAttachmentMessage, validateChatFile, formatSeconds, friendlyError, base64ToArrayBuffer, CHAT_LIMITS, CHAT_KIND_LABELS,
  type ChatAttachmentKind, type ChatMessage } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { shrinkAsset } from "../lib/image";
import { useDataSaver } from "../lib/dataSaver";
import { C, ui } from "../lib/ui";
import { Button, Message } from "./Ui";
import { VideoPlayer } from "./Video";

/** Voz: AAC (m4a), mono e leve — 3 minutos ≈ 0,7 MB. Toca no Android, no iPhone e no Site. */
const VOICE: RecordingOptions = { ...RecordingPresets.HIGH_QUALITY, sampleRate: 22050, numberOfChannels: 1, bitRate: 32000 };

type Draft = { kind: ChatAttachmentKind; uri: string; base64?: string | null; type: string; seconds: number | null; size?: number | null };

export function ChatAttachButtons({ conversationId, uid, caption, onSent }: { conversationId: string; uid: string; caption: string; onSent: () => void }) {
  const [draft, setDraft] = useState<Draft | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const recorder = useAudioRecorder(VOICE); const rec = useAudioRecorderState(recorder, 250);
  const seconds = rec.durationMillis / 1000;
  useEffect(() => { if (rec.isRecording && seconds >= CHAT_LIMITS.audio.seconds!) void stop(); }, [seconds, rec.isRecording]);

  async function pick(kind: "image" | "video", camera: boolean) {
    setError("");
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError(camera ? "Autorize a câmara." : "Autorize o acesso à galeria."); return; }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: [kind === "image" ? "images" : "videos"], quality: 0.8, videoMaxDuration: CHAT_LIMITS.video.seconds };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    if (kind === "image") {
      const s = await shrinkAsset(a);
      setDraft({ kind, uri: s.uri, base64: s.base64, type: s.mimeType || "image/jpeg", seconds: null });
    } else {
      const secs = a.duration != null ? a.duration / 1000 : null; const type = a.mimeType || "video/mp4";
      const bad = validateChatFile({ type, size: a.fileSize ?? null, seconds: secs }); if (bad) { setError(bad); return; }
      setDraft({ kind, uri: a.uri, type, seconds: secs, size: a.fileSize ?? null });
    }
  }
  async function record() {
    setError("");
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) { setError("Autorize o microfone para gravar mensagens de voz."); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync(); recorder.record();
    } catch { setError("Não foi possível usar o microfone."); }
  }
  async function stop() {
    const secs = recorder.currentTime || seconds;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (!recorder.uri) { setError("A gravação falhou. Tente outra vez."); return; }
    const bad = validateChatFile({ type: "audio/mp4", seconds: secs }); if (bad) { setError(bad); return; }
    setDraft({ kind: "audio", uri: recorder.uri, type: "audio/mp4", seconds: secs });
  }
  async function send() {
    if (!draft) return; setBusy(true); setError("");
    try {
      const body = draft.base64 ? base64ToArrayBuffer(draft.base64) : await (await fetch(draft.uri)).arrayBuffer();
      const up = await uploadChatFile(supabase(), conversationId, uid, body, draft.type, draft.seconds);
      if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar o ficheiro.");
      const r = await sendAttachmentMessage(supabase(), conversationId, uid, { kind: draft.kind, path: up.data, seconds: draft.seconds }, caption);
      if (r.error) { void supabase().storage.from("chat-media").remove([up.data]); throw r.error; }
      setDraft(null); onSent();
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }

  return <View style={{ gap: 8 }}>
    {!draft && !rec.isRecording && <View style={ui.row}>
      <Button title="📷 Fotografar" variant="secondary" onPress={() => void pick("image", true)} />
      <Button title="🖼️ Foto da galeria" variant="secondary" onPress={() => void pick("image", false)} />
      <Button title="🎬 Vídeo" variant="secondary" onPress={() => void pick("video", false)} />
      <Button title="🎤 Mensagem de voz" variant="secondary" onPress={() => void record()} />
    </View>}
    {rec.isRecording && <View style={[ui.card, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
      <Text accessibilityLiveRegion="polite" style={{ color: C.red, fontWeight: "800", fontSize: 17 }}>● A gravar {formatSeconds(seconds)} / {formatSeconds(CHAT_LIMITS.audio.seconds)}</Text>
      <Button title="⏹️ Parar" onPress={() => void stop()} />
    </View>}
    {!!draft && <View style={ui.card}>
      <Text style={ui.label}>{CHAT_KIND_LABELS[draft.kind]}{draft.seconds ? ` · ${formatSeconds(draft.seconds)}` : ""}</Text>
      {draft.kind === "image" && <Image source={{ uri: draft.uri }} style={{ width: 200, height: 200, borderRadius: 12 }} accessibilityLabel="Fotografia escolhida" />}
      {draft.kind === "audio" && <VoicePlayer url={draft.uri} seconds={draft.seconds} />}
      <Text style={ui.muted}>O texto escrito em cima segue junto (opcional).</Text>
      <Button title={busy ? "A enviar…" : "Enviar"} disabled={busy} onPress={() => void send()} />
      <Button title="Cancelar" variant="secondary" disabled={busy} onPress={() => setDraft(null)} />
    </View>}
    <Message error={error} />
  </View>;
}

/** Leitor da mensagem de voz: só descarrega quando se carrega em ▶. */
function VoicePlayer({ url, seconds }: { url: string; seconds?: number | null }) {
  const [on, setOn] = useState(false);
  if (!on) return <Pressable accessibilityRole="button" accessibilityLabel={`Ouvir mensagem de voz, ${formatSeconds(seconds)}`} onPress={() => setOn(true)} style={[ui.chip, { alignSelf: "flex-start" }]}>
    <Text style={ui.chipText}>▶ Ouvir · {formatSeconds(seconds)}</Text>
  </Pressable>;
  return <VoicePlaying url={url} seconds={seconds} />;
}
function VoicePlaying({ url, seconds }: { url: string; seconds?: number | null }) {
  const player = useAudioPlayer(url); const st = useAudioPlayerStatus(player);
  useEffect(() => { player.play(); }, [player]);
  const playing = st.playing; const total = st.duration || seconds || 0;
  return <Pressable accessibilityRole="button" accessibilityLabel={playing ? "Pausar" : "Continuar"} style={[ui.chip, { alignSelf: "flex-start" }]}
    onPress={() => { if (playing) player.pause(); else { if (st.didJustFinish || st.currentTime >= total - 0.2) player.seekTo(0); player.play(); } }}>
    <Text style={ui.chipText}>{playing ? "⏸️" : "▶"} {formatSeconds(st.currentTime)} / {formatSeconds(total)}</Text>
  </Pressable>;
}

/** Anexo dentro da conversa. Com «Poupar dados», a fotografia só carrega quando se pede. */
export function MessageAttachment({ m, url }: { m: ChatMessage; url?: string }) {
  const { on: lite } = useDataSaver(); const [show, setShow] = useState(false);
  if (!m.attachment_kind) return null;
  if (!url) return <Text style={ui.muted}>{CHAT_KIND_LABELS[m.attachment_kind]} (a carregar…)</Text>;
  if (m.attachment_kind === "audio") return <VoicePlayer url={url} seconds={m.attachment_seconds} />;
  if (m.attachment_kind === "video") return <VideoPlayer url={url} />;
  if (lite && !show) return <Pressable accessibilityRole="button" onPress={() => setShow(true)} style={[ui.chip, { alignSelf: "flex-start" }]}><Text style={ui.chipText}>📷 Ver fotografia (gasta dados)</Text></Pressable>;
  return <Pressable accessibilityRole="imagebutton" accessibilityLabel="Fotografia enviada — abrir" onPress={() => void Linking.openURL(url)}>
    <Image source={{ uri: url }} style={{ width: 220, height: 220, borderRadius: 12, backgroundColor: C.surface }} resizeMode="cover" />
  </Pressable>;
}
