import { useRef, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useVideoPlayer, VideoView } from "expo-video";
import { uploadVideo, removeUnsavedVideo, validateVideo, videoTypeFromName, friendlyError, VIDEO_MAX_SECONDS } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui, C } from "../lib/ui";
import { Button, Message } from "./Ui";

/** Campo "Vídeo (opcional)": escolhe da galeria, valida (60 s / 30 MB) e envia logo. */
export function VideoField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const unsaved = useRef<string | null>(null);
  async function choose() {
    setError("");
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError("Autorize o acesso à galeria para escolher um vídeo."); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], videoMaxDuration: VIDEO_MAX_SECONDS, allowsMultipleSelection: false, quality: 1 });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    const name = a.fileName || "video.mp4";
    const type = a.mimeType || videoTypeFromName(name);
    const invalid = validateVideo({ size: a.fileSize ?? null, type, durationSeconds: a.duration != null ? a.duration / 1000 : null });
    if (invalid) { setError(invalid); return; }
    const c = supabase(); const { data: { user } } = await c.auth.getUser();
    if (!user) { setError("Inicie sessão para enviar vídeos."); return; }
    setBusy(true);
    try {
      const body = await (await fetch(a.uri)).arrayBuffer();
      const up = await uploadVideo(c, user.id, body, name, type);
      if (up.error || !up.data) throw up.error ?? new Error("Falha no envio do vídeo.");
      if (unsaved.current) void removeUnsavedVideo(c, unsaved.current);
      unsaved.current = up.data; onChange(up.data);
    } catch (e) { setError(friendlyError(e, "Não foi possível enviar o vídeo.")); }
    finally { setBusy(false); }
  }
  function remove() {
    if (unsaved.current && unsaved.current === value) { void removeUnsavedVideo(supabase(), value); unsaved.current = null; }
    onChange("");
  }
  return <View style={ui.card}>
    <Text style={ui.label}>🎬 Vídeo (opcional)</Text>
    <Text style={ui.muted}>1 vídeo, até {VIDEO_MAX_SECONDS} segundos e 30 MB. Os vídeos de artigos fechados ou vendidos são apagados automaticamente.</Text>
    {value ? <>
      <Text style={ui.ok}>✔ Vídeo pronto</Text>
      <VideoPlayer url={value} />
      <Button title="Remover vídeo" variant="secondary" onPress={remove} disabled={busy} />
    </> : <Button title={busy ? "A enviar o vídeo…" : "🎬 Escolher vídeo"} variant="secondary" onPress={() => void choose()} disabled={busy} />}
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
  const [on, setOn] = useState(false);
  if (on) return <Player url={url} />;
  return <Pressable accessibilityRole="button" accessibilityLabel="Ver vídeo" onPress={() => setOn(true)}
    style={{ width: width - 32, height: (width - 32) * 0.5625, backgroundColor: "#111", borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 6 }}>
    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.white, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 28, color: C.ink, marginLeft: 4 }}>▶</Text></View>
    <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 16 }}>Ver vídeo</Text>
  </Pressable>;
}
