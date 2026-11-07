import { useEffect } from "react";
import { Stack, usePathname, useRouter } from "expo-router";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { startAuthAutoRefresh } from "../lib/supabase";
import { BottomNav } from "../components/BottomNav";
import { C } from "../lib/ui";
import { ThemeProvider, useThemeController } from "../lib/theme";
import { DataSaverProvider } from "../lib/dataSaver";
import { I18nProvider } from "../lib/i18n";
import { startReferralClaim } from "../lib/referral";
import { startPush } from "../lib/push";
import { startHealth, screenViewed } from "../lib/health";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { AppLock } from "../components/AppLock";
import { Onboarding } from "../components/Onboarding";
import { useT } from "../lib/i18n";

export default function Layout() {
  useEffect(() => startAuthAutoRefresh(), []);
  useEffect(() => startReferralClaim(), []);
  const router = useRouter();
  // Notificações no telemóvel: regista o telemóvel e abre o sítio certo ao tocar num aviso.
  useEffect(() => startPush(href => router.push(href as any)), []);
  useEffect(() => startHealth(), []);
  const path = usePathname();
  useEffect(() => { if (path) screenViewed(path); }, [path]);
  const theme = useThemeController();
  // key={theme.mode}: ao mudar de tema, tudo é desenhado de novo com as cores do tema escolhido.
  return <ThemeProvider value={theme}><I18nProvider><DataSaverProvider>
    <View key={theme.mode} style={{ flex: 1, backgroundColor: C.white }}>
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
      <SafeScreens><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.white } }} /></SafeScreens>
      <BottomNav />
      <Onboarding />
      <AppLock />
    </View>
  </DataSaverProvider></I18nProvider></ThemeProvider>;
}

/** Os ecrãs ficam dentro da proteção contra falhas (com textos na língua escolhida). */
function SafeScreens({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  return <ErrorBoundary labels={{ title: t("err.title"), text: t("err.text"), retry: t("err.retry") }}>{children}</ErrorBoundary>;
}
