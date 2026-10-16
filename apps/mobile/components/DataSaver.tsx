import { Pressable, Text, View } from "react-native";
import { savedTextIn, useT } from "../lib/i18n";
import { useDataSaver } from "../lib/dataSaver";
import { ui } from "../lib/ui";
import { Chips } from "./Ui";

/** «Poupar dados: Ligado · Desligado», com o que já se poupou. */
export function DataSaverPicker() {
  const { on, setOn, skipped } = useDataSaver(); const { t } = useT();
  return <View style={[ui.card, { gap: 10 }]}>
    <Text style={ui.h2}>📉 {t("nav.data_saver")}</Text>
    <Text style={ui.muted}>{t("data.hint")}</Text>
    <Chips options={[{ value: "on" as const, label: t("data.on") }, { value: "off" as const, label: t("data.off") }]} value={on ? "on" : "off"} onChange={v => setOn(v === "on")} />
    {on && skipped > 0 && <Text style={ui.ok}>{savedTextIn(skipped, t)}</Text>}
  </View>;
}

/** Botão rápido: liga ou desliga «Poupar dados». */
export function DataSaverToggle() {
  const { on, setOn } = useDataSaver(); const { t } = useT();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={on ? t("data.turn_off") : t("data.turn_on")}
    onPress={() => setOn(!on)} style={[ui.chip, { paddingVertical: 6 }]}>
    <Text style={ui.chipText}>{on ? t("data.toggle_on") : t("data.toggle")}</Text>
  </Pressable>;
}
