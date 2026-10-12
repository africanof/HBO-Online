import { Appearance, StyleSheet } from "react-native";
import { PALETTES, type Palette, type ThemeMode } from "@huambo-online/core";

/**
 * Estilos comuns da APP (inspirados no eBay): botões grandes em pílula, azul forte, cartões limpos e contraste alto.
 * Tema claro e escuro: «C» (cores) e «ui» (estilos) dão sempre os do tema atual. O tema muda em
 * app/_layout.tsx (Automático segue o telemóvel; Claro/Escuro escolhidos na Conta).
 */
let mode: ThemeMode = Appearance.getColorScheme() === "dark" ? "dark" : "light";
export function getThemeMode(): ThemeMode { return mode; }
export function setThemeMode(m: ThemeMode) { mode = m; }

/** Cria estilos que acompanham o tema (um conjunto por tema, criado na primeira vez que é usado). */
export function themed<T extends object>(make: (p: Palette) => T): T {
  const cache: Partial<Record<ThemeMode, T>> = {};
  return new Proxy({} as T, { get: (_t, key) => ((cache[mode] ??= make(PALETTES[mode])) as any)[key] });
}
/** Cores do tema atual (white = fundo, ink = texto, blue = ações, onAccent = texto sobre botões…). */
export const C = new Proxy({} as Palette, { get: (_t, key) => (PALETTES[mode] as any)[key] });

export const ui = themed(C => StyleSheet.create({
  screen: { padding: 16, paddingTop: 54, gap: 14, paddingBottom: 120, backgroundColor: C.white },
  h1: { fontSize: 28, fontWeight: "800", color: C.ink, letterSpacing: -0.3 },
  h2: { fontSize: 21, fontWeight: "800", color: C.ink },
  text: { fontSize: 17, color: C.ink, lineHeight: 24 },
  muted: { fontSize: 15, color: C.muted },
  label: { fontSize: 16, fontWeight: "700", color: C.ink },
  input: { borderWidth: 2, borderColor: C.inputBorder, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, color: C.ink, backgroundColor: C.card },
  area: { minHeight: 110, textAlignVertical: "top" },
  button: { minHeight: 52, borderRadius: 999, backgroundColor: C.blue, alignItems: "center", justifyContent: "center", paddingHorizontal: 22 },
  buttonText: { color: C.onAccent, fontSize: 17, fontWeight: "800" },
  buttonSecondary: { minHeight: 52, borderRadius: 999, borderWidth: 2, borderColor: C.blue, backgroundColor: C.white, alignItems: "center", justifyContent: "center", paddingHorizontal: 22 },
  buttonSecondaryText: { color: C.blue, fontSize: 17, fontWeight: "800" },
  danger: { minHeight: 52, borderRadius: 999, backgroundColor: C.red, alignItems: "center", justifyContent: "center", paddingHorizontal: 22 },
  chip: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16, backgroundColor: C.surface },
  chipOn: { borderWidth: 1, borderColor: C.ink, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16, backgroundColor: C.ink },
  chipText: { color: C.ink, fontWeight: "700", fontSize: 15 },
  chipTextOn: { color: C.white, fontWeight: "700", fontSize: 15 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, gap: 8, backgroundColor: C.card },
  error: { color: C.red, fontWeight: "800", fontSize: 16 },
  ok: { color: C.green, fontWeight: "800", fontSize: 16 },
  price: { fontSize: 22, fontWeight: "800", color: C.ink },
  link: { color: C.blue, fontWeight: "800", fontSize: 17 }
}));
