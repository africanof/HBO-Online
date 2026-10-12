import { useEffect } from "react";
import { Image, StyleSheet, Text, View, type ImageProps } from "react-native";
import { useDataSaver } from "../lib/dataSaver";
import { C } from "../lib/ui";

/** Imagem que não carrega com «Poupar dados» ligado: mostra um ícone no lugar da fotografia. */
export function LiteImage({ placeholder = "📷", ...props }: ImageProps & { placeholder?: string }) {
  const { on, countSkipped } = useDataSaver();
  const uri = typeof props.source === "object" && props.source && !Array.isArray(props.source) ? (props.source as { uri?: string }).uri ?? "" : "";
  useEffect(() => { if (on && uri) countSkipped(uri); }, [on, uri]);
  if (on) return <View style={[StyleSheet.flatten(props.style) as object, { backgroundColor: C.surface, alignItems: "center", justifyContent: "center" }]}
    accessibilityLabel={props.accessibilityLabel ? props.accessibilityLabel + " (não carregada para poupar dados)" : undefined}
    importantForAccessibility={props.accessibilityLabel ? "yes" : "no-hide-descendants"}>
    <Text style={{ fontSize: 28 }}>{placeholder}</Text>
  </View>;
  return <Image {...props} />;
}
