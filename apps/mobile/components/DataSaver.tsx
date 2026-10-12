import { Pressable, Text, View } from "react-native";
import { savedText } from "@huambo-online/core";
import { useDataSaver } from "../lib/dataSaver";
import { ui } from "../lib/ui";
import { Chips } from "./Ui";

/** «Poupar dados: Ligado · Desligado», com o que já se poupou. */
export function DataSaverPicker() {
  const { on, setOn, skipped } = useDataSaver();
  return <View style={[ui.card, { gap: 10 }]}>
    <Text style={ui.h2}>📉 Poupar dados</Text>
    <Text style={ui.muted}>Gaste menos saldo: as fotografias das listas não carregam e, nos anúncios, só carregam quando tocar. Os vídeos só carregam quando carrega em ▶.</Text>
    <Chips options={[{ value: "on" as const, label: "📉 Ligado" }, { value: "off" as const, label: "Desligado" }]} value={on ? "on" : "off"} onChange={v => setOn(v === "on")} />
    {on && skipped > 0 && <Text style={ui.ok}>{savedText(skipped)}</Text>}
  </View>;
}

/** Botão rápido: liga ou desliga «Poupar dados». */
export function DataSaverToggle() {
  const { on, setOn } = useDataSaver();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={on ? "Desligar Poupar dados" : "Ligar Poupar dados"}
    onPress={() => setOn(!on)} style={[ui.chip, { paddingVertical: 6 }]}>
    <Text style={ui.chipText}>{on ? "📉 A poupar dados" : "📉 Poupar dados"}</Text>
  </Pressable>;
}
