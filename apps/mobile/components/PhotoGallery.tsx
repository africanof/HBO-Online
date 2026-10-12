import { useState } from "react";
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useDataSaver } from "../lib/dataSaver";
import { C, ui } from "../lib/ui";
import { Button } from "./Ui";

/** Fotografias do anúncio/produto. Com «Poupar dados» ligado, só carregam quando a pessoa toca. */
export function PhotoGallery({ media, icon = "📷" }: { media: string[]; icon?: string }) {
  const { width } = useWindowDimensions();
  const { on } = useDataSaver();
  const [photo, setPhoto] = useState(0); const [reveal, setReveal] = useState(false);
  if (!media.length) return null;
  if (on && !reveal) return <View style={[ui.card, { alignItems: "center", gap: 8, borderStyle: "dashed" }]}>
    <Text style={{ fontSize: 44 }}>{icon}</Text>
    <Text style={[ui.text, { textAlign: "center" }]}>📉 Poupar dados ligado: as fotografias ainda não foram carregadas.</Text>
    <Button title={media.length === 1 ? "📷 Ver a fotografia" : `📷 Ver as ${media.length} fotografias`} onPress={() => setReveal(true)} />
  </View>;
  const i = Math.min(photo, media.length - 1);
  return <View style={{ gap: 8 }}>
    <Image source={{ uri: media[i] }} style={{ width: width - 40, height: (width - 40) * 0.75, borderRadius: 12, backgroundColor: C.surface }} resizeMode="contain" accessibilityLabel={`Fotografia ${i + 1} de ${media.length}`} />
    {media.length > 1 && <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{media.map((m, j) => <Pressable key={m} onPress={() => setPhoto(j)} accessibilityLabel={`Ver fotografia ${j + 1}`} style={{ borderWidth: 3, borderColor: j === i ? C.ink : "transparent", borderRadius: 8 }}><Image source={{ uri: m }} style={{ width: 68, height: 68, borderRadius: 6 }} /></Pressable>)}</ScrollView>}
  </View>;
}
