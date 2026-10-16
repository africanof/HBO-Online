import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LANGS, LANG_FLAGS, LANG_LABELS, LANG_TAGS, makeT, type Lang } from "@huambo-online/core";
import { DICT, useT } from "../lib/i18n";
import { themed, ui } from "../lib/ui";

/**
 * Escolha da língua: botões grandes com bandeira e nome (Português · English · 中文).
 * Os nomes ficam sempre na própria língua, para quem não lê português os encontrar.
 * Depois de escolher inglês ou chinês, avisa uma vez que algumas páginas ainda estão só em português.
 * `compact`: só os botões (página inicial); sem `compact`: cartão com título (conta).
 */
export function LanguagePicker({ compact = false }: { compact?: boolean }) {
  const { lang, t, setLang } = useT();
  const [notice, setNotice] = useState<Lang | null>(null);
  const choose = (l: Lang) => {
    if (l === lang) return;
    setLang(l);
    setNotice(l === "pt" ? null : l);
  };
  const buttons = <View style={s.row} accessibilityRole="radiogroup" accessibilityLabel={t("lang.choose")}>
    {LANGS.map(l => {
      const on = l === lang;
      return <Pressable key={l} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLanguage={LANG_TAGS[l]}
        accessibilityLabel={makeT(DICT, l)("lang.change_to", { name: LANG_LABELS[l] })} onPress={() => choose(l)}
        style={({ pressed }) => [s.btn, on && s.btnOn, pressed && { opacity: 0.8 }]}>
        <Text style={s.flag}>{LANG_FLAGS[l]}</Text>
        <Text style={[s.label, on && s.labelOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{LANG_LABELS[l]}</Text>
      </Pressable>;
    })}
  </View>;
  const partial = notice && notice === lang ? <View accessibilityRole="alert" style={s.notice}>
    <Text style={s.noticeText}>✔ {t("lang.saved")}</Text>
    <Pressable accessibilityRole="button" onPress={() => setNotice(null)} style={s.close}><Text style={ui.link}>{t("common.close")}</Text></Pressable>
  </View> : null;
  if (compact) return <View style={{ gap: 8 }}>{buttons}{partial}</View>;
  return <View style={[ui.card, { gap: 10 }]}>
    <Text style={ui.h2}>🌐 {t("lang.choose")}</Text>
    {buttons}
    {partial}
  </View>;
}

const s = themed(C => StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btn: { flexGrow: 1, flexBasis: 96, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 2, borderColor: C.line, borderRadius: 999, paddingHorizontal: 12, backgroundColor: C.surface },
  btnOn: { borderColor: C.ink, backgroundColor: C.ink },
  flag: { fontSize: 22 },
  label: { fontSize: 16, fontWeight: "800", color: C.ink, flexShrink: 1 },
  labelOn: { color: C.white },
  notice: { backgroundColor: C.yellowSoft, borderColor: C.yellowLine, borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  noticeText: { color: C.yellowText, fontSize: 16, fontWeight: "700" },
  close: { alignSelf: "flex-end", minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }
}));
