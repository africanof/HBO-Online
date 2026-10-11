import { Link } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { HELP_FAQ, contactLine } from "@huambo-online/core";
import { ui } from "../lib/ui";
import { FaqList, InfoLinks, CONTACT_EMAIL } from "../components/InfoPage";

export default function Ajuda() {
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/" style={ui.link}>← Início</Link>
    <Text style={ui.h1}>❓ Ajuda</Text>
    <Text style={ui.text}>Respostas às perguntas mais comuns. Toque numa pergunta para ver a resposta.</Text>
    <FaqList items={HELP_FAQ} />
    <View style={ui.card}><Text style={ui.h2}>Precisa de mais ajuda?</Text><Text style={ui.text}>{contactLine(CONTACT_EMAIL)}</Text></View>
    <InfoLinks />
  </ScrollView>;
}
