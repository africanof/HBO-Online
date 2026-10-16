import { useRef, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useVideoPlayer, VideoView } from "expo-video";
import { uploadVideo, removeUnsavedVideo, validateVideo, videoTypeFromName, friendlyErrorIn, VIDEO_MAX_SECONDS } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui, C } from "../lib/ui";
import { Button, Message } from "./Ui";
import { useT } from "../lib/i18n";

/** Campo "Vídeo (opcional)": escolhe da galeria, valida (60 s / 30 MB) e envia logo. */
export function VideoField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const { t, tc, lang } = useT();
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const unsaved = useRef<string | null>(null);
  async function choose() {
    setError("");
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError(t("sv.video_gallery_perm")); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], videoMaxDuration: VIDEO_MAX_SECONDS, allowsMultipleSelection: false, quality: 1 });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    const name = a.fileName || "video.mp4";
    const type = a.mimeType || videoTypeFromName(name);
    const invalid = validateVideo({ size: a.fileSize ?? null, type, durationSeconds: a.duration != null ? a.duration / 1000 : null });
    if (invalid) { setError(tc(invalid)); return; }
    const c = supabase(); const { data: { user } } = await c.auth.getUser();
    if (!user) { setError(t("sv.video_login")); return; }
    setBusy(true);
    try {
      const body = await (await fetch(a.uri)).arrayBuffer();
      const up = await uploadVideo(c, user.id, body, name, type);
      if (up.error || !up.data) throw up.error ?? new Error(t("sv.video_upload_fail"));
      if (unsaved.current) void removeUnsavedVideo(c, unsaved.current);
      unsaved.current = up.data; onChange(up.data);
    } catch (e) { setError(friendlyErrorIn(e, lang, t("sv.video_upload_error"))); }
    finally { setBusy(false); }
  }
  function remove() {
    if (unsaved.current && unsaved.current === value) { void removeUnsavedVideo(supabase(), value); unsaved.current = null; }
    onChange("");
  }
  return <View style={ui.card}>
    <Text style={ui.label}>{t("sv.video_optional")}</Text>
    <Text style={ui.muted}>{t("sv.video_hint", { s: VIDEO_MAX_SECONDS })}</Text>
    {value ? <>
      <Text style={ui.ok}>{t("sv.video_ready")}</Text>
      <VideoPlayer url={value} />
      <Button title={t("sv.video_remove")} variant="secondary" onPress={remove} disabled={busy} />
    </> : <Button title={busy ? t("sv.video_uploading") : t("sv.video_choose")} variant="secondary" onPress={() => void choose()} disabled={busy} />}
    <Message error={error} />
  </View>;
}

function Player({ url }: { url: string }) {
  const { width } = useWindowDimensions();
  const player = useVideoPlayer(url, p => { p.play(); });
  return <VideoView player={player} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }}
    style={{ width: width - 32, height: (width - 32) * 0.5625, backgroundColor: "#000", borderRadius: 12 }} />;
}

/** Vídeo do artigo: só descarrega depois de carregar em ▶ (poupa dados móveis). */
export function VideoPlayer({ url }: { url: string }) {
  const { width } = useWindowDimensions();
  const { t } = useT();
  const [on, setOn] = useState(false);
  if (on) return <Player url={url} />;
  return <Pressable accessibilityRole="button" accessibilityLabel={t("sv.video_watch")} onPress={() => setOn(true)}
    style={{ width: width - 32, height: (width - 32) * 0.5625, backgroundColor: "#111", borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 6 }}>
    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.white, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 28, color: C.ink, marginLeft: 4 }}>▶</Text></View>
    <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 16 }}>{t("sv.video_watch")}</Text>
  </Pressable>;
}
