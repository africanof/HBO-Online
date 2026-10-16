import { useEffect, useState } from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { ListingForm } from "../../components/ListingForm";
import { currentUserId } from "../../lib/supabase";
import { ui } from "../../lib/ui";
import { useT } from "../../lib/i18n";

export default function Publicar() {
  const params = useLocalSearchParams<{ finalidade?: string; modo?: string; campo?: string; agente?: string }>();
  const wanted = params.finalidade === "wanted"; const { t } = useT();
  const [user, setUser] = useState<string | null | undefined>(undefined);
  useEffect(() => { void currentUserId().then(setUser).catch(() => setUser(null)); }, []);
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/" style={ui.link}>← Huambo Online</Link>
    <Text style={ui.h1}>{wanted ? t("home.post_wanted") : t("ls.publish.title")}</Text>
    {!wanted && <Link href={"/classificados/publicar?finalidade=wanted" as any} style={ui.link}>{t("ls.publish.want_buy")}</Link>}
    {user === undefined && <Text style={ui.text}>{t("common.loading")}</Text>}
    {user === null && <View style={{ gap: 10 }}><Text style={ui.text}>{t("ls.publish.sign_in")}</Text><Link href="/login" style={ui.link}>{t("auth.login")}</Link><Link href="/criar-conta" style={ui.link}>{t("auth.signup")}</Link></View>}
    {!!user && <ListingForm key={(wanted ? "w" : "s") + (params.modo ?? "") + (params.campo ? "c" : "")} initialPurpose={wanted ? "wanted" : undefined} initialSaleMode={params.modo} initialAgro={!!params.campo} initialAgent={params.agente} />}
  </ScrollView>;
}
