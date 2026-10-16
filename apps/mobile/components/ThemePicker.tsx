import { Pressable, Text, View } from "react-native";
import { THEME_OPTIONS, type ThemePreference } from "@huambo-online/core";
import { useT } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { ui } from "../lib/ui";
import { Chips } from "./Ui";

/** «Aparência: Automático · Claro · Escuro» (fica guardado no telemóvel). */
export function ThemePicker() {
  const { preference, setPreference } = useTheme(); const { t } = useT();
  const options = THEME_OPTIONS.map(o => ({ value: o.value, label: t("theme." + o.value) }));
  return <View style={[ui.card, { gap: 10 }]}>
    <Text style={ui.h2}>🌓 {t("nav.appearance")}</Text>
    <Text style={ui.muted}>{t("theme.hint")}</Text>
    <Chips<ThemePreference> options={options} value={preference} onChange={setPreference} />
  </View>;
}

/** Botão rápido: «🌙 Modo escuro» / «☀️ Modo claro» (troca e fica guardado). */
export function ThemeToggle() {
  const { mode, setPreference } = useTheme(); const { t } = useT();
  const dark = mode === "dark";
  return <Pressable accessibilityRole="button" accessibilityLabel={dark ? t("theme.to_light") : t("theme.to_dark")}
    onPress={() => setPreference(dark ? "light" : "dark")} style={[ui.chip, { paddingVertical: 6 }]}>
    <Text style={ui.chipText}>{dark ? t("theme.light_mode") : t("theme.dark_mode")}</Text>
  </Pressable>;
}
