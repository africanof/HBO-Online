import { useEffect, useRef, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { C } from "../lib/ui";
import { useT } from "../lib/i18n";

/** «Entrar com impressão digital»: a escolha fica só neste telemóvel. */
export const LOCK_KEY = "huambo:bloqueio";
const AWAY_MS = 60_000; // volta a pedir depois de 1 minuto fora da APP

export async function lockAvailable(): Promise<boolean> {
  try { return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync()); } catch { return false; }
}
export async function lockEnabled(): Promise<boolean> { try { return (await AsyncStorage.getItem(LOCK_KEY)) === "1"; } catch { return false; } }
/** Liga/desliga: pede a impressão digital antes de ligar, para confirmar que funciona. */
export async function setLockEnabled(on: boolean, prompt: string): Promise<boolean> {
  if (on) {
    if (!(await lockAvailable())) return false;
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: prompt });
    if (!r.success) return false;
  }
  try { await AsyncStorage.setItem(LOCK_KEY, on ? "1" : "0"); } catch { /* opcional */ }
  return true;
}

/** Tapa a APP até a pessoa se identificar (ao abrir e ao voltar depois de 1 minuto). */
export function AppLock() {
  const { t } = useT();
  const [locked, setLocked] = useState(false); const away = useRef<number | null>(null);
  async function unlock() {
    try {
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: t("lock.prompt") });
      if (r.success) setLocked(false);
    } catch { setLocked(false); }
  }
  useEffect(() => {
    void lockEnabled().then(on => { if (on) { setLocked(true); void unlock(); } });
    const sub = AppState.addEventListener("change", s => {
      if (s === "background") away.current = Date.now();
      if (s === "active" && away.current && Date.now() - away.current > AWAY_MS) {
        away.current = null;
        void lockEnabled().then(on => { if (on) { setLocked(true); void unlock(); } });
      }
    });
    return () => sub.remove();
  }, []);
  if (!locked) return null;
  return <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.white, alignItems: "center", justifyContent: "center", gap: 16, zIndex: 1000, elevation: 1000 }}>
    <Text style={{ fontSize: 56 }}>🔒</Text>
    <Text style={{ fontSize: 22, fontWeight: "800", color: C.ink }}>{t("lock.locked")}</Text>
    <Pressable accessibilityRole="button" onPress={() => void unlock()} style={{ backgroundColor: C.blue, borderRadius: 999, paddingHorizontal: 28, minHeight: 52, justifyContent: "center" }}>
      <Text style={{ color: C.onAccent, fontWeight: "800", fontSize: 17 }}>👆 {t("lock.unlock")}</Text>
    </Pressable>
  </View>;
}
