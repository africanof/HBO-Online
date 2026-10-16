import { Link } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SCAM_WARNING_TEXT } from "@huambo-online/core";
import { ui } from "../lib/ui";
import { SafeSpotsList, TipsList } from "../components/Safety";
import { useT } from "../lib/i18n";

export default function Seguranca() {
  const { t, tc } = useT();
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/ajuda" style={ui.link}>{t("sv.help_back")}</Link>
    <Text style={ui.h1}>{t("sv.safety_title")}</Text>
    <Text style={ui.text}>{t("sv.safety_intro")}</Text>
    <View style={ui.card}><Text style={ui.h2}>{t("sv.safety_rules")}</Text><TipsList /></View>
    <View style={ui.card}><Text style={ui.h2}>{t("sv.safety_spots")}</Text><Text style={ui.text}>{t("sv.safety_spots_text")}</Text><SafeSpotsList /></View>
    <View style={ui.card}><Text style={ui.h2}>{t("sv.safety_scam")}</Text><Text style={ui.text}>{t("sv.safety_scam_text")}</Text><TipsList tips={Object.values(SCAM_WARNING_TEXT).map(x => tc(x))} /></View>
    <View style={ui.card}><Text style={ui.h2}>{t("sv.safety_block")}</Text><Text style={ui.text}>{t("sv.safety_block_text")}</Text></View>
  </ScrollView>;
}
