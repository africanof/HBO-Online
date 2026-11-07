import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { C } from "../lib/ui";
import { useT } from "../lib/i18n";

const KEY = "huambo:apresentacao";
const SLIDES = [{ icon: "🛡️", t: "onb.t1", d: "onb.d1" }, { icon: "🔍", t: "onb.t2", d: "onb.d2" }, { icon: "📸", t: "onb.t3", d: "onb.d3" }];

/** Apresentação de 3 ecrãs na primeira vez que a APP abre. */
export function Onboarding() {
  const { t } = useT();
  const [show, setShow] = useState(false); const [i, setI] = useState(0);
  useEffect(() => { void AsyncStorage.getItem(KEY).then(v => { if (!v) setShow(true); }).catch(() => {}); }, []);
  function done() { setShow(false); void AsyncStorage.setItem(KEY, "1").catch(() => {}); }
  if (!show) return null;
  const s = SLIDES[i]; const last = i === SLIDES.length - 1;
  return <View accessibilityViewIsModal style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.white, zIndex: 900, elevation: 900, padding: 28, paddingTop: 60 }}>
    <Pressable accessibilityRole="button" onPress={done} style={{ alignSelf: "flex-end", padding: 8 }}><Text style={{ color: C.muted, fontSize: 16, fontWeight: "700" }}>{t("onb.skip")}</Text></Pressable>
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18 }}>
      <View style={{ width: 150, height: 150, borderRadius: 75, backgroundColor: C.blueSoft, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 72 }}>{s.icon}</Text></View>
      <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: "800", color: C.ink, textAlign: "center" }}>{t(s.t)}</Text>
      <Text style={{ fontSize: 17, lineHeight: 25, color: C.muted, textAlign: "center" }}>{t(s.d)}</Text>
    </View>
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 20 }}>
      {SLIDES.map((_, k) => <View key={k} style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: k === i ? C.blue : C.line }} />)}
    </View>
    <Pressable accessibilityRole="button" onPress={() => last ? done() : setI(i + 1)} style={{ backgroundColor: C.blue, borderRadius: 999, minHeight: 54, alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
      <Text style={{ color: C.onAccent, fontWeight: "800", fontSize: 18 }}>{last ? t("onb.start") : t("onb.next")}</Text>
    </Pressable>
  </View>;
}
