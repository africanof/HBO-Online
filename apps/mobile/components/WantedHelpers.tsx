import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";
import { findHelpers, ratingLabel } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Shelf } from "./ItemCard";
import { LiteImage } from "./LiteImage";
import { useT, coreText } from "../lib/i18n";

/** «Profissionais e empresas que podem ajudar» num pedido «Procura-se». */
export function WantedHelpers({ title, mine }: { title: string; mine: boolean }) {
  const router = useRouter(); const { t, tc } = useT();
  const [h, setH] = useState<{ providers: any[]; businesses: any[] } | null>(null);
  useEffect(() => { void findHelpers(supabase(), title, 8).then(setH); }, [title]);
  if (!h || (!h.providers.length && !h.businesses.length)) return null;
  return <View style={{ gap: 6 }}>
    {mine && <Text style={ui.muted}>{t("ls.helpers.notified")}</Text>}
    <Shelf title={mine ? t("ls.helpers.can_help") : t("ls.helpers.also_help")}>
      {h.providers.map(p => <Pressable key={p.user_id} accessibilityRole="link" onPress={() => router.push(("/profissionais/" + p.user_id) as any)} style={[ui.card, { width: 180 }]}>
        {p.avatar_url ? <LiteImage placeholder="👤" source={{ uri: p.avatar_url }} style={{ width: 52, height: 52, borderRadius: 26 }} /> : <Text style={{ fontSize: 34 }}>👷</Text>}
        <Text style={ui.label} numberOfLines={2}>{p.display_name}{p.verified ? " ✔️" : ""}</Text>
        <Text style={ui.muted} numberOfLines={1}>{[p.category_name, p.municipality_name].filter(Boolean).join(" · ")}</Text>
        <Text style={ui.muted}>{tc(coreText(ratingLabel(p.rating, p.review_count), t) ?? "")}</Text>
      </Pressable>)}
      {h.businesses.map(b => <Pressable key={b.id} accessibilityRole="link" onPress={() => router.push(("/empresas/" + b.id) as any)} style={[ui.card, { width: 180 }]}>
        <Text style={{ fontSize: 34 }}>🏢</Text>
        <Text style={ui.label} numberOfLines={2}>{b.name}{b.verified ? " ✔️" : ""}</Text>
        <Text style={ui.muted} numberOfLines={1}>{[b.category_name, b.municipality_name].filter(Boolean).join(" · ")}</Text>
        <Text style={ui.muted}>{tc(coreText(ratingLabel(b.rating, b.review_count), t) ?? "")}</Text>
      </Pressable>)}
    </Shelf>
  </View>;
}
