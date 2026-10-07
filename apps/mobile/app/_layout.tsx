import { useEffect } from "react";
import { Stack } from "expo-router";
import { startAuthAutoRefresh } from "../lib/supabase";

export default function Layout() {
  useEffect(() => startAuthAutoRefresh(), []);
  return <Stack screenOptions={{ headerShown: false }} />;
}
