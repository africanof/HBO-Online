import { useRef, useState } from "react";
import { Image, Modal, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { IDENTITY_SHOTS, normalizeBiNumber, validateIdentityRequest, requestIdentityVerification, base64ToArrayBuffer, friendlyErrorIn,
  type IdentityShot } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { shrinkAsset } from "../lib/image";
import { C, ui } from "../lib/ui";
import { Button, Message } from "./Ui";
import { useT } from "../lib/i18n";

type Local = { uri: string; base64?: string | null; mimeType: string };
type Shot = (typeof IDENTITY_SHOTS)[number];
const MAX_SIDE = 1600;

async function localBytes(p: Local) { return p.base64 ? base64ToArrayBuffer(p.base64) : await (await fetch(p.uri)).arrayBuffer(); }

/** Moldura por cima da câmara: cartão para o BI, oval para a cara. */
function Guide({ shot }: { shot: Shot }) {
  const { t } = useT();
  const frame = { borderWidth: 4, borderColor: "#fff", borderStyle: "dashed" as const };
  return <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
    {shot.key === "selfie"
      ? <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={[frame, { width: 170, height: 230, borderRadius: 115 }]} />
          <View style={[frame, { width: 90, height: 58, borderRadius: 8 }]} />
        </View>
      : <View style={[frame, { width: "86%", aspectRatio: 1.586, borderRadius: 14 }]} />}
    <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 16, textAlign: "center", paddingHorizontal: 20, textShadowColor: "#000", textShadowRadius: 6 }}>
      {shot.key === "selfie" ? t("sv.id_guide_selfie") : t("sv.id_guide_card")}
    </Text>
  </View>;
}

/** Câmara dentro da APP (sem galeria): tira uma fotografia e reduz para o lado maior ter no máximo 1600 px. */
function CameraModal({ shot, onClose, onPhoto }: { shot: Shot; onClose: () => void; onPhoto: (p: Local) => void }) {
  const { t, tc } = useT();
  const ref = useRef<CameraView>(null); const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function take() {
    if (!ref.current || busy) return;
    setBusy(true); setError("");
    try {
      const pic = await ref.current.takePictureAsync({ quality: 0.8 });
      if (!pic?.uri) throw new Error("no photo");
      const small = await shrinkAsset({ uri: pic.uri, width: pic.width, height: pic.height, mimeType: "image/jpeg" }, MAX_SIDE);
      onPhoto(small);
    } catch { setError(t("sv.id_photo_fail")); }
    finally { setBusy(false); }
  }
  return <Modal visible animationType="slide" onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <View style={{ flex: 1 }}>
        <CameraView ref={ref} style={{ flex: 1 }} facing={shot.camera} onCameraReady={() => setReady(true)} />
        <Guide shot={shot} />
      </View>
      <View style={{ padding: 16, gap: 10, backgroundColor: C.surface }}>
        <Text style={ui.h2}>{tc(shot.title)}</Text>
        <Text style={ui.text}>{tc(shot.hint)}</Text>
        {!!error && <Text style={ui.error}>{error}</Text>}
        <Button title={busy ? t("sv.saving") : t("sv.take_photo")} disabled={!ready || busy} onPress={() => void take()} />
        <Button title={t("common.cancel")} variant="secondary" disabled={busy} onPress={onClose} />
      </View>
    </View>
  </Modal>;
}

/**
 * Verificação da identidade: frente e verso do BI e uma selfie com o BI, sempre tiradas na hora com a câmara,
 * mais o número do BI. Tudo fica guardado em privado; só a administração vê.
 */
export function IdentityCapture({ userId, onSent }: { userId: string; onSent: () => void }) {
  const { t, tc, lang } = useT();
  const [perm, ask] = useCameraPermissions();
  const [shots, setShots] = useState<Record<IdentityShot, Local | null>>({ front: null, back: null, selfie: null });
  const [current, setCurrent] = useState<Shot | null>(null);
  const [idNumber, setIdNumber] = useState(""); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");

  async function open(shot: Shot) {
    setError("");
    const p = perm?.granted ? perm : await ask();
    if (!p.granted) { setError(t("sv.id_camera_perm")); return; }
    setCurrent(shot);
  }
  async function send() {
    if (busy) return;
    const bad = validateIdentityRequest({ ...shots, idNumber }); if (bad) { setError(tc(bad)); return; }
    setBusy(true); setError("");
    try {
      const [front, back, selfie] = await Promise.all([localBytes(shots.front!), localBytes(shots.back!), localBytes(shots.selfie!)]);
      const r = await requestIdentityVerification(supabase(), userId, { front, back, selfie }, idNumber, note);
      if (r.error) throw r.error;
      setShots({ front: null, back: null, selfie: null }); setIdNumber(""); setNote("");
      onSent();
    } catch (e) { setError(friendlyErrorIn(e, lang, t("sv.ver_fail"))); }
    finally { setBusy(false); }
  }

  const done = IDENTITY_SHOTS.filter(s => shots[s.key]).length;
  const numberOk = !!normalizeBiNumber(idNumber);
  return <View style={{ gap: 12 }}>
    <Text style={ui.text}>{t("sv.id_intro")}</Text>
    <Text style={ui.muted}>{t("sv.id_count", { n: done })}</Text>
    {IDENTITY_SHOTS.map(s => {
      const p = shots[s.key];
      return <View key={s.key} style={[ui.card, { backgroundColor: C.surface }]}>
        <Text style={ui.label}>{tc(s.title)}{p ? " ✔" : ""}</Text>
        <Text style={ui.muted}>{tc(s.hint)}</Text>
        {p ? <>
          <Image source={{ uri: p.uri }} accessibilityLabel={t("sv.photo_of", { title: tc(s.title) })} resizeMode="contain" style={{ width: "100%", height: 200, borderRadius: 10, backgroundColor: "#000" }} />
          <Button title={t("sv.id_retake")} variant="secondary" disabled={busy} onPress={() => void open(s)} />
        </> : <Button title={s.key === "selfie" ? t("sv.id_take_selfie") : t("sv.id_shoot")} disabled={busy} onPress={() => void open(s)} />}
      </View>;
    })}
    <Text style={ui.label}>{t("sv.id_number")}</Text>
    <TextInput style={[ui.input, { letterSpacing: 1 }]} value={idNumber} onChangeText={v => setIdNumber(v.toUpperCase())} placeholder="004512345LA042"
      autoCapitalize="characters" autoCorrect={false} maxLength={20} accessibilityLabel={t("sv.id_number")} />
    {!!idNumber.trim() && (numberOk
      ? <Text style={ui.ok}>{t("sv.id_number_ok")}</Text>
      : <Text style={ui.muted}>{t("sv.id_number_hint")}</Text>)}
    <TextInput style={[ui.input, ui.area]} multiline value={note} onChangeText={setNote} placeholder={t("sv.ver_note_ph")} />
    <Text style={ui.muted}>{t("sv.id_privacy")}</Text>
    <Message error={error} />
    <Button title={busy ? t("sv.sending") : t("sv.ver_send")} disabled={busy} onPress={() => void send()} />
    {!!current && <CameraModal key={current.key} shot={current} onClose={() => setCurrent(null)}
      onPhoto={p => { if (current) setShots(s => ({ ...s, [current.key]: p })); setCurrent(null); }} />}
  </View>;
}
