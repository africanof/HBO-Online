import { StyleSheet } from "react-native";

/** Estilos comuns: botões grandes e contraste alto. */
export const ui = StyleSheet.create({
  screen: { padding: 20, paddingTop: 54, gap: 14, paddingBottom: 60 },
  h1: { fontSize: 30, fontWeight: "800", color: "#111" },
  h2: { fontSize: 22, fontWeight: "800", color: "#111" },
  text: { fontSize: 17, color: "#111" },
  muted: { fontSize: 15, color: "#444" },
  label: { fontSize: 16, fontWeight: "700", color: "#111" },
  input: { borderWidth: 2, borderColor: "#bbb", borderRadius: 10, padding: 12, fontSize: 17, color: "#111", backgroundColor: "#fff" },
  area: { minHeight: 110, textAlignVertical: "top" },
  button: { minHeight: 50, borderRadius: 10, backgroundColor: "#111", alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  buttonSecondary: { minHeight: 50, borderRadius: 10, borderWidth: 2, borderColor: "#111", backgroundColor: "#fff", alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  buttonSecondaryText: { color: "#111", fontSize: 17, fontWeight: "800" },
  danger: { minHeight: 50, borderRadius: 10, backgroundColor: "#a30000", alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  chip: { borderWidth: 2, borderColor: "#111", borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: "#fff" },
  chipOn: { borderWidth: 2, borderColor: "#111", borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: "#111" },
  chipText: { color: "#111", fontWeight: "700", fontSize: 15 },
  chipTextOn: { color: "#fff", fontWeight: "700", fontSize: 15 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: { borderWidth: 2, borderColor: "#ddd", borderRadius: 14, padding: 14, gap: 8, backgroundColor: "#fff" },
  error: { color: "#a30000", fontWeight: "800", fontSize: 16 },
  ok: { color: "#0b5d1e", fontWeight: "800", fontSize: 16 },
  price: { fontSize: 22, fontWeight: "800", color: "#111" },
  link: { color: "#0b5d1e", fontWeight: "800", fontSize: 17 }
});
