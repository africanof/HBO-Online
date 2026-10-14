import { useRef, useState } from "react";
import { Modal, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { C, ui } from "../lib/ui";
import { Button } from "./Ui";

/** Botão que abre a câmara e lê um QR (bilhetes de eventos, reservas de combustível). */
export function QrScanButton({ title = "📷 Ler QR do cliente", onCode }: { title?: string; onCode: (text: string) => void }) {
  const [open, setOpen] = useState(false); const [perm, ask] = useCameraPermissions(); const [error, setError] = useState("");
  const done = useRef(false);
  async function start() {
    setError("");
    const p = perm?.granted ? perm : await ask();
    if (!p.granted) { setError("Autorize a câmara para ler o QR."); return; }
    done.current = false; setOpen(true);
  }
  return <>
    <Button title={title} onPress={() => void start()} />
    {!!error && <Text style={ui.error}>{error}</Text>}
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={r => { if (done.current || !r.data) return; done.current = true; setOpen(false); onCode(r.data); }} />
        <View style={{ padding: 16, gap: 10, backgroundColor: C.surface }}>
          <Text style={ui.label}>Aponte a câmara para o QR</Text>
          <Button title="Fechar" variant="secondary" onPress={() => setOpen(false)} />
        </View>
      </View>
    </Modal>
  </>;
}
