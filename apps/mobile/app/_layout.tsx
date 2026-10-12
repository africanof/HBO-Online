import { useEffect } from "react";
import { Stack } from "expo-router";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { startAuthAutoRefresh } from "../lib/supabase";
import { BottomNav } from "../components/BottomNav";
import { C } from "../lib/ui";
import { ThemeProvider, useThemeController } from "../lib/theme";
import { DataSaverProvider } from "../lib/dataSaver";

export default function Layout() {
  useEffect(() => startAuthAutoRefresh(), []);
  const theme = useThemeController();
  // key={theme.mode}: ao mudar de tema, tudo é desenhado de novo com as cores do tema escolhido.
  return <ThemeProvider value={theme}><DataSaverProvider>
    <View key={theme.mode} style={{ flex: 1, backgroundColor: C.white }}>
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.white } }} />
      <BottomNav />
    </View>
  </DataSaverProvider></ThemeProvider>;
}
