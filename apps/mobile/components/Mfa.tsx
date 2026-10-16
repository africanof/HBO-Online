import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { mfaRequired, verifyLoginTotp, mfaErrorMessage, qrMatrix } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Message } from "./Ui";

/** Campo grande para os 6 algarismos da APP autenticadora. */
export function TotpCodeInput({ value, onChangeText, onSubmit }: { value: string; onChangeText: (t: string) => void; onSubmit?: () => void }) {
  return <TextInput value={value} onChangeText={t => onChangeText(t.replace(/\D/g, "").slice(0, 6))} onSubmitEditing={onSubmit}
    keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} placeholder="123456"
    accessibilityLabel="Código de 6 algarismos" style={[ui.input, { fontSize: 30, letterSpacing: 8, textAlign: "center", fontWeight: "800" }]} />;
}

/**
 * Segundo passo: pede o código de 6 algarismos da APP autenticadora e confirma a sessão (aal2).
 * Usado ao entrar, na Administração e no ecrã de segurança da conta.
 */
export function MfaPrompt({ title = "🔐 Código da APP autenticadora", text = "Abra a APP autenticadora (Google Authenticator, Microsoft Authenticator ou Authy) e escreva os 6 algarismos que aparecem para o Huambo Online.",
  onDone, onCancel, cancelLabel = "Cancelar" }: { title?: string; text?: string; onDone: () => void; onCancel?: () => void; cancelLabel?: string }) {
  const [code, setCode] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function confirm() {
    if (busy) return; setBusy(true); setError("");
    try {
      const r = await verifyLoginTotp(supabase(), code);
      if (r.error) { setError(mfaErrorMessage(r.error)); setCode(""); return; }
      onDone();
    } catch (e) { setError(mfaErrorMessage(e)); } finally { setBusy(false); }
  }
  return <View style={ui.card}>
    <Text style={ui.h2}>{title}</Text>
    <Text style={ui.text}>{text}</Text>
    <TotpCodeInput value={code} onChangeText={setCode} onSubmit={() => void confirm()} />
    <Message error={error} />
    <Button title={busy ? "A confirmar…" : "Confirmar"} disabled={busy || code.length !== 6} onPress={() => void confirm()} />
    {!!onCancel && <Button title={cancelLabel} variant="secondary" disabled={busy} onPress={onCancel} />}
  </View>;
}

/** Verifica se a sessão ainda precisa do código (aal1 com APP ligada). "checking" → "need" ou "ok". */
export function useMfaCheck(enabled = true): ["checking" | "need" | "ok", () => void] {
  const [state, setState] = useState<"checking" | "need" | "ok">("checking");
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void mfaRequired(supabase()).then(need => { if (alive) setState(need ? "need" : "ok"); }).catch(() => { if (alive) setState("ok"); });
    return () => { alive = false; };
  }, [enabled]);
  return [state, () => setState("ok")];
}

/** QR desenhado com quadrados (sem bibliotecas nativas), para ler com outro telemóvel. */
export function QrView({ text, size = 260, label }: { text: string; size?: number; label: string }) {
  const m = qrMatrix(text); const n = m.length + 4; const cell = Math.max(2, Math.floor(size / n));
  return <View accessible accessibilityLabel={label} style={{ backgroundColor: "#fff", padding: cell * 2, borderRadius: 8, alignSelf: "center" }}>
    {m.map((row, y) => {
      // Junta os quadrados seguidos da mesma cor para desenhar menos peças.
      const runs: { on: boolean; len: number }[] = [];
      for (const on of row) { const last = runs[runs.length - 1]; if (last && last.on === on) last.len++; else runs.push({ on, len: 1 }); }
      return <View key={y} style={{ flexDirection: "row" }}>{runs.map((r, i) => <View key={i} style={{ width: cell * r.len, height: cell, backgroundColor: r.on ? "#000" : "#fff" }} />)}</View>;
    })}
  </View>;
}
