import { BRAND } from "./design";

/**
 * Tema claro e escuro (igual no Site e na APP). As cores têm nomes pelo papel que fazem:
 * «white» é o fundo da página e «ink» o texto (no escuro trocam), «blue» as ações…
 * Todas as combinações de texto foram escolhidas com contraste ≥ 4,5:1 (ver theme.test.ts).
 */
export type ThemeMode = "light" | "dark";
export type ThemePreference = ThemeMode | "system";
export const THEME_STORAGE_KEY = "huambo:tema";

const LIGHT = {
  ...BRAND,
  card: "#FFFFFF",
  onAccent: "#FFFFFF",       // texto sobre os botões azuis
  inputBorder: "#767676",
  yellowSoft: "#FFF4D6", yellowText: "#4A3700", yellowLine: "#E0B100",
  greenSoft: "#E5F6EA", greenText: "#0B6B2B",
  blueText: "#1F3FAE",
  goldSoft: "#FFF6D6", goldText: "#6B4E00", starOn: "#B07A00", starOff: "#767676",
  placeholder: "#DDDDDD",
  logoBlue: BRAND.blue, logoRed: BRAND.red, logoYellow: "#B88200", logoGreen: BRAND.green
};
export type Palette = { [K in keyof typeof LIGHT]: string };

const DARK: Palette = {
  blue: "#7AA2FF", blueDark: "#A8C1FF", blueSoft: "#1E2A47",
  ink: "#F2F3F5", muted: "#B0B6BF", line: "#343A42", surface: "#1C1F24",
  red: "#FF6B7A", green: "#4CD38A", yellow: "#F5AF02",
  white: "#121417",
  card: "#181B20",
  onAccent: "#0B1530",
  inputBorder: "#8A919B",
  yellowSoft: "#3A2F10", yellowText: "#F8D57A", yellowLine: "#8A6A12",
  greenSoft: "#12301F", greenText: "#7CE0A6",
  blueText: "#A8C1FF",
  goldSoft: "#3A2F10", goldText: "#F8D57A", starOn: "#F5AF02", starOff: "#8A919B",
  placeholder: "#2A2F36",
  logoBlue: "#7AA2FF", logoRed: "#FF6B7A", logoYellow: "#F5AF02", logoGreen: "#4CD38A"
};

export const PALETTES: Record<ThemeMode, Palette> = { light: LIGHT, dark: DARK };

/** Tema a usar: a escolha da pessoa, ou o do telemóvel/computador em «Automático». */
export function resolveTheme(pref: string | null | undefined, systemDark: boolean): ThemeMode {
  return pref === "light" || pref === "dark" ? pref : systemDark ? "dark" : "light";
}
export function readThemePreference(v: string | null | undefined): ThemePreference {
  return v === "light" || v === "dark" ? v : "system";
}
export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "🌓 Automático" }, { value: "light", label: "☀️ Claro" }, { value: "dark", label: "🌙 Escuro" }
];

/** As quatro partes do logótipo com as cores do tema. */
export function logoParts(mode: ThemeMode): [string, string][] {
  const p = PALETTES[mode];
  return [["Huambo", p.logoBlue], ["On", p.logoRed], ["li", p.logoYellow], ["ne", p.logoGreen]];
}

/** Contraste entre duas cores (WCAG). */
export function contrastRatio(a: string, b: string): number {
  const lum = (h: string) => {
    const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
