import { Link } from "expo-router";
import { Linking, ScrollView, Text } from "react-native";
import { ui } from "../lib/ui";
import { useT } from "../lib/i18n";
import { HelpAssistant } from "../components/AiTools";
import { CONTACT_EMAIL } from "../components/InfoPage";

/** Suporte: a IA responde primeiro; «👤 Falar com um agente» abre a conversa com a equipa nas Mensagens. */
export default function Suporte() {
  const { t } = useT();
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(CONTACT_EMAIL) ? CONTACT_EMAIL : "";
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href={"/ajuda" as any} style={ui.link}>← {t("nav.help")}</Link>
    <Text style={ui.h1}>{t("sp.title")}</Text>
    <Text style={ui.text}>{t("sp.intro")}</Text>
    <HelpAssistant />
    {!!email && <Text style={ui.link} accessibilityRole="link" onPress={() => void Linking.openURL("mailto:" + email)}>{t("sp.email", { email })}</Text>}
  </ScrollView>;
}
