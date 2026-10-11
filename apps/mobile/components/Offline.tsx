import { Text, View } from "react-native";
import { offlineNotice } from "@huambo-online/core";

/** Faixa amarela «Sem internet — a mostrar o que foi guardado…». */
export function OfflineBanner({ savedAt, show }: { savedAt: number | null; show: boolean }) {
  if (!show) return null;
  return <View accessibilityRole="alert" style={{ backgroundColor: "#FFF4CC", borderColor: "#E0B100", borderWidth: 1, borderRadius: 12, padding: 12 }}>
    <Text style={{ color: "#4A3700", fontSize: 16, fontWeight: "700" }}>{offlineNotice(savedAt)}</Text>
  </View>;
}
