import { useEffect } from "react";
import { Stack } from "expo-router";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { startAuthAutoRefresh } from "../lib/supabase";
import { BottomNav } from "../components/BottomNav";
import { C } from "../lib/ui";

export default function Layout() {
  useEffect(() => startAuthAutoRefresh(), []);
  return <View style={{ flex: 1, backgroundColor: C.white }}>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.white } }} />
    <BottomNav />
  </View>;
}
