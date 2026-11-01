import { useEffect, useState } from "react";
import { Image, Linking, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useAudioRecorder, useAudioRecorderState, useAudioPlayer, useAudioPlayerStatus, requestRecordingPermissionsAsync, setAudioModeAsync, RecordingPresets,
  type RecordingOptions } from "expo-audio";
import { uploadChatFile, sendAttachmentMessage, validateChatFile, chatAttachmentKind, documentTypeFromName, CHAT_DOCUMENT_TYPES, formatSeconds, friendlyErrorIn, base64ToArrayBuffer, CHAT_LIMITS, CHAT_KIND_LABELS,
  type ChatAttachmentKind, type ChatMessage } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { shrinkAsset } from "../lib/image";
import { useDataSaver } from "../lib/dataSaver";
import { C, ui } from "../lib/ui";
import { Button, Message } from "./Ui";
import { VideoPlayer } from "./Video";
import { useT } from "../lib/i18n";

/** Voz: AAC (m4a), mono e leve — 3 minutos ≈ 0,7 MB. Toca no Android, no iPhone e no Site. */
const VOICE: RecordingOptions = { ...RecordingPresets.HIGH_QUALITY, sampleRate: 22050, numberOfChannels: 1, bitRate: 32000 };

type Draft = { kind: ChatAttachmentKind; uri: string; base64?: string | null; type: string; seconds: number | null; size?: number | null; name?: string };

/** Com allowDocuments (vagas de emprego e estágios) aparece também «📄 Documento» para enviar CV em Word ou PDF. */
export function ChatAttachButtons({ conversationId, uid, caption, onSent, allowDocuments = false }: { conversationId: string; uid: string; caption: string; onSent: () => void; allowDocuments?: boolean }) {
  const { t, tc, lang } = useT();
  const [draft, setDraft] = useState<Draft | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const recorder = useAudioRecorder(VOICE); const rec = useAudioRecorderState(recorder, 250);
  const seconds = rec.durationMillis / 1000;
  useEffect(() => { if (rec.isRecording && seconds >= CHAT_LIMITS.audio.seconds!) void stop(); }, [seconds, rec.isRecording]);

  async function pick(kind: "image" | "video", camera: boolean) {
    setError("");
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError(camera ? t("ls.cm.perm_camera") : t("ls.photo.perm_gallery")); return; }
    // Vídeos: no iPhone o próprio telemóvel comprime para qualidade média antes de enviar.
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: [kind === "image" ? "images" : "videos"], quality: 0.8, videoMaxDuration: CHAT_LIMITS.video.seconds,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium, videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    if (kind === "image") {
      const s = await shrinkAsset(a);
      setDraft({ kind, uri: s.uri, base64: s.base64, type: s.mimeType || "image/jpeg", seconds: null });
    } else {
      const secs = a.duration != null ? a.duration / 1000 : null; const type = a.mimeType || "video/mp4";
      const bad = validateChatFile({ type, size: a.fileSize ?? null, seconds: secs }); if (bad) { setError(tc(bad)); return; }
      setDraft({ kind, uri: a.uri, type, seconds: secs, size: a.fileSize ?? null });
    }
  }
  async function pickDocument() {
    setError("");
    const r = await DocumentPicker.getDocumentAsync({ type: [...CHAT_DOCUMENT_TYPES], copyToCacheDirectory: true, multiple: false });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    const type = chatAttachmentKind(a.mimeType) === "document" ? a.mimeType! : documentTypeFromName(a.name);
    if (!type) { setError(t("ls.chat_pick_document")); return; }
    const bad = validateChatFile({ type, size: a.size ?? null }); if (bad) { setError(tc(bad)); return; }
    setDraft({ kind: "document", uri: a.uri, type, seconds: null, size: a.size ?? null, name: a.name });
  }
  async function record() {
    setError("");
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) { setError(t("ls.cm.perm_mic")); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync(); recorder.record();
    } catch { setError(t("ls.cm.mic_failed")); }
  }
  async function stop() {
    const secs = recorder.currentTime || seconds;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (!recorder.uri) { setError(t("ls.cm.rec_failed")); return; }
    const bad = validateChatFile({ type: "audio/mp4", seconds: secs }); if (bad) { setError(tc(bad)); return; }
    setDraft({ kind: "audio", uri: recorder.uri, type: "audio/mp4", seconds: secs });
  }
  async function send() {
    if (!draft) return; setBusy(true); setError("");
    try {
      const body = draft.base64 ? base64ToArrayBuffer(draft.base64) : await (await fetch(draft.uri)).arrayBuffer();
      const up = await uploadChatFile(supabase(), conversationId, uid, body, draft.type, draft.seconds);
      if (up.error || !up.data) throw up.error ?? new Error(t("ls.cm.upload_failed"));
      const r = await sendAttachmentMessage(supabase(), conversationId, uid, { kind: draft.kind, path: up.data, seconds: draft.seconds }, caption);
      if (r.error) { void supabase().storage.from("chat-media").remove([up.data]); throw r.error; }
      setDraft(null); onSent();
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }

  return <View style={{ gap: 8 }}>
    {!draft && !rec.isRecording && <View style={ui.row}>
      <Button title={t("ls.cm.shoot")} variant="secondary" onPress={() => void pick("image", true)} />
      <Button title={t("ls.cm.gallery")} variant="secondary" onPress={() => void pick("image", false)} />
      <Button title={t("ls.cm.video")} variant="secondary" onPress={() => void pick("video", false)} />
      <Button title={t("ls.cm.voice")} variant="secondary" onPress={() => void record()} />
      {allowDocuments && <Button title={"📄 " + t("ls.document_cv")} variant="secondary" onPress={() => void pickDocument()} />}
    </View>}
    {rec.isRecording && <View style={[ui.card, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
      <Text accessibilityLiveRegion="polite" style={{ color: C.red, fontWeight: "800", fontSize: 17 }}>{t("ls.cm.recording", { time: formatSeconds(seconds), max: formatSeconds(CHAT_LIMITS.audio.seconds) })}</Text>
      <Button title={t("ls.cm.stop")} onPress={() => void stop()} />
    </View>}
    {!!draft && <View style={ui.card}>
      <Text style={ui.label}>{tc(CHAT_KIND_LABELS[draft.kind])}{draft.seconds ? ` · ${formatSeconds(draft.seconds)}` : ""}</Text>
      {draft.kind === "image" && <Image source={{ uri: draft.uri }} style={{ width: 200, height: 200, borderRadius: 12 }} accessibilityLabel={t("ls.cm.chosen")} />}
      {draft.kind === "audio" && <VoicePlayer url={draft.uri} seconds={draft.seconds} />}
      {draft.kind === "document" && <Text style={ui.text}>📄 {draft.name}</Text>}
      <Text style={ui.muted}>{t("ls.cm.caption")}</Text>
      <Button title={busy ? t("ls.sending") : t("common.send")} disabled={busy} onPress={() => void send()} />
      <Button title={t("common.cancel")} variant="secondary" disabled={busy} onPress={() => setDraft(null)} />
    </View>}
    <Message error={error} />
  </View>;
}

/** Leitor da mensagem de voz: só descarrega quando se carrega em ▶. */
function VoicePlayer({ url, seconds }: { url: string; seconds?: number | null }) {
  const [on, setOn] = useState(false); const { t } = useT();
  if (!on) return <Pressable accessibilityRole="button" accessibilityLabel={t("ls.cm.listen_a11y", { time: formatSeconds(seconds) })} onPress={() => setOn(true)} style={[ui.chip, { alignSelf: "flex-start" }]}>
    <Text style={ui.chipText}>{t("ls.cm.listen", { time: formatSeconds(seconds) })}</Text>
  </Pressable>;
  return <VoicePlaying url={url} seconds={seconds} />;
}
function VoicePlaying({ url, seconds }: { url: string; seconds?: number | null }) {
  const { t } = useT();
  const player = useAudioPlayer(url); const st = useAudioPlayerStatus(player);
  useEffect(() => { player.play(); }, [player]);
  const playing = st.playing; const total = st.duration || seconds || 0;
  return <Pressable accessibilityRole="button" accessibilityLabel={playing ? t("ls.pause") : t("ls.cm.resume")} style={[ui.chip, { alignSelf: "flex-start" }]}
    onPress={() => { if (playing) player.pause(); else { if (st.didJustFinish || st.currentTime >= total - 0.2) player.seekTo(0); player.play(); } }}>
    <Text style={ui.chipText}>{playing ? "⏸️" : "▶"} {formatSeconds(st.currentTime)} / {formatSeconds(total)}</Text>
  </Pressable>;
}

/** Anexo dentro da conversa. Com «Poupar dados», a fotografia só carrega quando se pede. */
export function MessageAttachment({ m, url }: { m: ChatMessage; url?: string }) {
  const { on: lite } = useDataSaver(); const { t, tc } = useT(); const [show, setShow] = useState(false);
  if (!m.attachment_kind) return null;
  if (!url) return <Text style={ui.muted}>{tc(CHAT_KIND_LABELS[m.attachment_kind])} {t("ls.cm.loading")}</Text>;
  if (m.attachment_kind === "document") return <Button title={"📄 " + t("ls.open_document")} variant="secondary" onPress={() => void Linking.openURL(url)} />;
  if (m.attachment_kind === "audio") return <VoicePlayer url={url} seconds={m.attachment_seconds} />;
  if (m.attachment_kind === "video") return <VideoPlayer url={url} />;
  if (lite && !show) return <Pressable accessibilityRole="button" onPress={() => setShow(true)} style={[ui.chip, { alignSelf: "flex-start" }]}><Text style={ui.chipText}>{t("ls.cm.see_photo")}</Text></Pressable>;
  return <Pressable accessibilityRole="imagebutton" accessibilityLabel={t("ls.cm.sent_photo")} onPress={() => void Linking.openURL(url)}>
    <Image source={{ uri: url }} style={{ width: 220, height: 220, borderRadius: 12, backgroundColor: C.surface }} resizeMode="cover" />
  </Pressable>;
}
