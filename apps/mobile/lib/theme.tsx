import { createContext, useContext, useEffect, useState } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { THEME_STORAGE_KEY, readThemePreference, resolveTheme, type ThemeMode, type ThemePreference } from "@huambo-online/core";
import { setThemeMode } from "./ui";

type ThemeState = { mode: ThemeMode; preference: ThemePreference; setPreference: (p: ThemePreference) => void };
const ThemeContext = createContext<ThemeState>({ mode: "light", preference: "system", setPreference: () => {} });
export const useTheme = () => useContext(ThemeContext);

/**
 * Escolhe o tema (Automático segue o telemóvel; Claro/Escuro ficam guardados no aparelho).
 * Quando o tema muda, a APP volta a desenhar tudo com as cores novas.
 */
export function useThemeController(): ThemeState {
  const [preference, setPref] = useState<ThemePreference>("system");
  const [systemDark, setSystemDark] = useState(Appearance.getColorScheme() === "dark");
  useEffect(() => {
    void AsyncStorage.getItem(THEME_STORAGE_KEY).then(v => setPref(readThemePreference(v))).catch(() => {});
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystemDark(colorScheme === "dark"));
    return () => sub.remove();
  }, []);
  const mode = resolveTheme(preference, systemDark);
  setThemeMode(mode); // antes de desenhar os ecrãs
  const setPreference = (p: ThemePreference) => {
    setPref(p);
    void (p === "system" ? AsyncStorage.removeItem(THEME_STORAGE_KEY) : AsyncStorage.setItem(THEME_STORAGE_KEY, p)).catch(() => {});
  };
  return { mode, preference, setPreference };
}
export const ThemeProvider = ThemeContext.Provider;
