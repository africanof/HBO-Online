import { Text, View } from "react-native";
import { THEME_OPTIONS, type ThemePreference } from "@huambo-online/core";
import { useTheme } from "../lib/theme";
import { ui } from "../lib/ui";
import { Chips } from "./Ui";

/** «Aparência: Automático · Claro · Escuro» (fica guardado no telemóvel). */
export function ThemePicker() {
  const { preference, setPreference } = useTheme();
  return <View style={[ui.card, { gap: 10 }]}>
    <Text style={ui.h2}>🌓 Aparência</Text>
    <Text style={ui.muted}>Automático segue o modo claro ou escuro do seu telemóvel.</Text>
    <Chips<ThemePreference> options={THEME_OPTIONS} value={preference} onChange={setPreference} />
  </View>;
}
