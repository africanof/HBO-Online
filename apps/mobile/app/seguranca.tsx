import { Link } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SCAM_WARNING_TEXT } from "@huambo-online/core";
import { ui } from "../lib/ui";
import { SafeSpotsList, TipsList } from "../components/Safety";

export default function Seguranca() {
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/ajuda" style={ui.link}>← Ajuda</Link>
    <Text style={ui.h1}>🛡️ Comprar e vender em segurança</Text>
    <Text style={ui.text}>A maior parte das pessoas é honesta. Estas regras simples protegem-no das poucas que não são.</Text>
    <View style={ui.card}><Text style={ui.h2}>✅ Regras de ouro</Text><TipsList /></View>
    <View style={ui.card}><Text style={ui.h2}>📍 Pontos de encontro seguros</Text><Text style={ui.text}>Para ver o artigo e pagar, combine num destes lugares:</Text><SafeSpotsList /></View>
    <View style={ui.card}><Text style={ui.h2}>⚠️ Sinais de burla</Text><Text style={ui.text}>Nas mensagens, o Huambo Online avisa-o quando a outra pessoa:</Text><TipsList tips={Object.values(SCAM_WARNING_TEXT)} /></View>
    <View style={ui.card}><Text style={ui.h2}>🚫 Bloquear e 🚩 Denunciar</Text><Text style={ui.text}>Numa conversa, carregue em «🚫 Bloquear» para deixar de receber mensagens dessa pessoa e em «🚩 Denunciar» para avisar a administração. Na Loja, use o Pagamento protegido quando estiver disponível: o dinheiro só chega ao vendedor depois de receber a encomenda.</Text></View>
  </ScrollView>;
}
