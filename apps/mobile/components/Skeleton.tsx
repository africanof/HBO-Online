import { useEffect, useRef } from "react";
import { Animated, View, useWindowDimensions } from "react-native";
import { C } from "../lib/ui";

/** Caixa cinzenta que «respira» enquanto o conteúdo carrega. */
export function Bone({ w, h, r = 10 }: { w: number | `${number}%`; h: number; r?: number }) {
  const o = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(o, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(o, { toValue: 0.5, duration: 650, useNativeDriver: true })
    ]));
    a.start(); return () => a.stop();
  }, []);
  return <Animated.View style={{ width: w, height: h, borderRadius: r, backgroundColor: C.line, opacity: o }} />;
}
function CardBone({ w }: { w: number }) {
  return <View style={{ width: w, gap: 8 }}><Bone w={w} h={w} r={14} /><Bone w="90%" h={14} /><Bone w="55%" h={16} /><Bone w="40%" h={12} /></View>;
}
/** Grelha de cartões a carregar (2 colunas). */
export function SkeletonGrid({ n = 6 }: { n?: number }) {
  const { width } = useWindowDimensions(); const w = (width - 32 - 14) / 2;
  return <View accessibilityLabel="…" style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 18 }}>
    {Array.from({ length: n }, (_, i) => <CardBone key={i} w={w} />)}
  </View>;
}
/** Prateleira horizontal a carregar. */
export function SkeletonShelf() {
  return <View style={{ gap: 10 }}><Bone w={160} h={20} />
    <View style={{ flexDirection: "row", gap: 12 }}>{[0, 1, 2].map(i => <CardBone key={i} w={150} />)}</View>
  </View>;
}
/** Linhas de lista a carregar (conversas, notificações). */
export function SkeletonRows({ n = 6 }: { n?: number }) {
  return <View style={{ gap: 16 }}>{Array.from({ length: n }, (_, i) => <View key={i} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
    <Bone w={48} h={48} r={24} /><View style={{ flex: 1, gap: 8 }}><Bone w="70%" h={14} /><Bone w="45%" h={12} /></View>
  </View>)}</View>;
}
