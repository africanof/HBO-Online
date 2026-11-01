import { Link } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { ui } from "../lib/ui";
import { FaqList, InfoLinks, useContactLine, useHelpFaq } from "../components/InfoPage";
import { useT } from "../lib/i18n";
import { HelpAssistant } from "../components/AiTools";

export default function Ajuda() {
  const { t } = useT(); const faq = useHelpFaq(); const contact = useContactLine();
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/" style={ui.link}>{t("sv.home_back")}</Link>
    <Text style={ui.h1}>{t("sv.help_title")}</Text>
    <Text style={ui.text}>{t("sv.help_intro")}</Text>
    <Link href={"/seguranca" as any} style={ui.link}>{t("sv.help_safety_link")}</Link>
    <HelpAssistant />
    <FaqList items={faq} />
    <View style={ui.card}><Text style={ui.h2}>{t("sv.help_more")}</Text><Text style={ui.text}>{contact}</Text></View>
    <InfoLinks />
  </ScrollView>;
}
