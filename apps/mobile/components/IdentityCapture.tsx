import { useRef, useState } from "react";
import { Image, Modal, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { IDENTITY_SHOTS, normalizeBiNumber, validateIdentityRequest, requestIdentityVerification, base64ToArrayBuffer, friendlyError,
  type IdentityShot } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { shrinkAsset } from "../lib/image";
import { C, ui } from "../lib/ui";
import { Button, Message } from "./Ui";

type Local = { uri: string; base64?: string | null; mimeType: string };
type Shot = (typeof IDENTITY_SHOTS)[number];
const MAX_SIDE = 1600;

async function localBytes(p: Local) { return p.base64 ? base64ToArrayBuffer(p.base64) : await (await fetch(p.uri)).arrayBuffer(); }

/** Moldura por cima da câmara: cartão para o BI, oval para a cara. */
function Guide({ shot }: { shot: Shot }) {
  const frame = { borderWidth: 4, borderColor: "#fff", borderStyle: "dashed" as const };
  return <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
    {shot.key === "selfie"
      ? <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={[frame, { width: 170, height: 230, borderRadius: 115 }]} />
          <View style={[frame, { width: 90, height: 58, borderRadius: 8 }]} />
        </View>
      : <View style={[frame, { width: "86%", aspectRatio: 1.586, borderRadius: 14 }]} />}
    <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 16, textAlign: "center", paddingHorizontal: 20, textShadowColor: "#000", textShadowRadius: 6 }}>
      {shot.key === "selfie" ? "Cara dentro do oval, BI ao lado" : "BI inteiro dentro da moldura"}
    </Text>
  </View>;
}

/** Câmara dentro da APP (sem galeria): tira uma fotografia e reduz para o lado maior ter no máximo 1600 px. */
function CameraModal({ shot, onClose, onPhoto }: { shot: Shot; onClose: () => void; onPhoto: (p: Local) => void }) {
  const ref = useRef<CameraView>(null); const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function take() {
    if (!ref.current || busy) return;
    setBusy(true); setError("");
    try {
      const pic = await ref.current.takePictureAsync({ quality: 0.8 });
      if (!pic?.uri) throw new Error("no photo");
      const small = await shrinkAsset({ uri: pic.uri, width: pic.width, height: pic.height, mimeType: "image/jpeg" }, MAX_SIDE);
      onPhoto(small);
    } catch { setError("Não foi possível tirar a fotografia. Tente novamente."); }
    finally { setBusy(false); }
  }
  return <Modal visible animationType="slide" onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <View style={{ flex: 1 }}>
        <CameraView ref={ref} style={{ flex: 1 }} facing={shot.camera} onCameraReady={() => setReady(true)} />
        <Guide shot={shot} />
      </View>
      <View style={{ padding: 16, gap: 10, backgroundColor: C.surface }}>
        <Text style={ui.h2}>{shot.title}</Text>
        <Text style={ui.text}>{shot.hint}</Text>
        {!!error && <Text style={ui.error}>{error}</Text>}
        <Button title={busy ? "A guardar…" : "📸 Tirar fotografia"} disabled={!ready || busy} onPress={() => void take()} />
        <Button title="Cancelar" variant="secondary" disabled={busy} onPress={onClose} />
      </View>
    </View>
  </Modal>;
}

/**
 * Verificação da identidade: frente e verso do BI e uma selfie com o BI, sempre tiradas na hora com a câmara,
 * mais o número do BI. Tudo fica guardado em privado; só a administração vê.
 */
export function IdentityCapture({ userId, onSent }: { userId: string; onSent: () => void }) {
  const [perm, ask] = useCameraPermissions();
  const [shots, setShots] = useState<Record<IdentityShot, Local | null>>({ front: null, back: null, selfie: null });
  const [current, setCurrent] = useState<Shot | null>(null);
  const [idNumber, setIdNumber] = useState(""); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");

  async function open(shot: Shot) {
    setError("");
    const p = perm?.granted ? perm : await ask();
    if (!p.granted) { setError("Autorize a câmara para fotografar o BI. Pode mudar isto nas Definições do telemóvel."); return; }
    setCurrent(shot);
  }
  async function send() {
    if (busy) return;
    const bad = validateIdentityRequest({ ...shots, idNumber }); if (bad) { setError(bad); return; }
    setBusy(true); setError("");
    try {
      const [front, back, selfie] = await Promise.all([localBytes(shots.front!), localBytes(shots.back!), localBytes(shots.selfie!)]);
      const r = await requestIdentityVerification(supabase(), userId, { front, back, selfie }, idNumber, note);
      if (r.error) throw r.error;
      setShots({ front: null, back: null, selfie: null }); setIdNumber(""); setNote("");
      onSent();
    } catch (e) { setError(friendlyError(e, "Não foi possível enviar o pedido.")); }
    finally { setBusy(false); }
  }

  const done = IDENTITY_SHOTS.filter(s => shots[s.key]).length;
  const numberOk = !!normalizeBiNumber(idNumber);
  return <View style={{ gap: 12 }}>
    <Text style={ui.text}>Vamos tirar 3 fotografias com a câmara: a frente do BI, o verso do BI e uma selfie a segurar o BI. Não dá para escolher da galeria.</Text>
    <Text style={ui.muted}>Fotografias tiradas: {done} de 3</Text>
    {IDENTITY_SHOTS.map(s => {
      const p = shots[s.key];
      return <View key={s.key} style={[ui.card, { backgroundColor: C.surface }]}>
        <Text style={ui.label}>{s.title}{p ? " ✔" : ""}</Text>
        <Text style={ui.muted}>{s.hint}</Text>
        {p ? <>
          <Image source={{ uri: p.uri }} accessibilityLabel={"Fotografia: " + s.title} resizeMode="contain" style={{ width: "100%", height: 200, borderRadius: 10, backgroundColor: "#000" }} />
          <Button title="🔄 Repetir" variant="secondary" disabled={busy} onPress={() => void open(s)} />
        </> : <Button title={s.key === "selfie" ? "🤳 Tirar a selfie" : "📷 Fotografar"} disabled={busy} onPress={() => void open(s)} />}
      </View>;
    })}
    <Text style={ui.label}>Número do BI</Text>
    <TextInput style={[ui.input, { letterSpacing: 1 }]} value={idNumber} onChangeText={t => setIdNumber(t.toUpperCase())} placeholder="004512345LA042"
      autoCapitalize="characters" autoCorrect={false} maxLength={20} accessibilityLabel="Número do BI" />
    {!!idNumber.trim() && (numberOk
      ? <Text style={ui.ok}>Número válido ✔</Text>
      : <Text style={ui.muted}>9 algarismos, 2 letras e 3 algarismos, como no BI (ex.: 004512345LA042).</Text>)}
    <TextInput style={[ui.input, ui.area]} multiline value={note} onChangeText={setNote} placeholder="Nota para a administração (opcional)" />
    <Text style={ui.muted}>🔒 Privacidade: as fotografias e o número do BI ficam guardados em privado. Só a administração os vê, apenas para confirmar que é mesmo você. Nunca aparecem no seu perfil; o perfil mostra só o selo «Identidade verificada».</Text>
    <Message error={error} />
    <Button title={busy ? "A enviar…" : "Enviar para verificação"} disabled={busy} onPress={() => void send()} />
    {!!current && <CameraModal key={current.key} shot={current} onClose={() => setCurrent(null)}
      onPhoto={p => { if (current) setShots(s => ({ ...s, [current.key]: p })); setCurrent(null); }} />}
  </View>;
}
