import { useEffect } from "react";
import { StyleSheet, Text, View, type ImageProps } from "react-native";
import { Image } from "expo-image";
import { useDataSaver } from "../lib/dataSaver";
import { C } from "../lib/ui";
import { useT } from "../lib/i18n";

/** Imagem que não carrega com «Poupar dados» ligado: mostra um ícone no lugar da fotografia.
 *  As fotografias ficam guardadas no telemóvel: na visita seguinte aparecem logo, sem gastar dados. */
export function LiteImage({ placeholder = "📷", ...props }: ImageProps & { placeholder?: string }) {
  const { on, countSkipped } = useDataSaver(); const { t } = useT();
  const uri = typeof props.source === "object" && props.source && !Array.isArray(props.source) ? (props.source as { uri?: string }).uri ?? "" : "";
  useEffect(() => { if (on && uri) countSkipped(uri); }, [on, uri]);
  if (on) return <View style={[StyleSheet.flatten(props.style) as object, { backgroundColor: C.surface, alignItems: "center", justifyContent: "center" }]}
    accessibilityLabel={props.accessibilityLabel ? props.accessibilityLabel + " " + t("ls.lite.skipped") : undefined}
    importantForAccessibility={props.accessibilityLabel ? "yes" : "no-hide-descendants"}>
    <Text style={{ fontSize: 28 }}>{placeholder}</Text>
  </View>;
  const { source, style, resizeMode, accessibilityLabel } = props;
  return <Image source={source as any} style={style as any} contentFit={resizeMode === "contain" ? "contain" : "cover"} cachePolicy="memory-disk" transition={150}
    recyclingKey={uri || undefined} accessibilityLabel={accessibilityLabel} accessible={!!accessibilityLabel} />;
}
