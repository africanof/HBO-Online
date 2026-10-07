import { Link, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { NotificationBell } from "../components/NotificationBell";
import { ui } from "../lib/ui";
import { Button } from "../components/Ui";

const modules = [
  ["Explorar classificados", "Pesquisar anúncios de compra, venda e aluguer.", "/explorar"],
  ["Os meus anúncios", "Editar, pausar ou apagar os seus anúncios.", "/meus-anuncios"],
  ["Mensagens", "Converse com anunciantes e compradores.", "/mensagens"],
  ["Notificações", "Acompanhe alertas e novidades.", "/notificacoes"],
  ["Pesquisas guardadas", "Receba alertas de novos anúncios.", "/pesquisas-guardadas"],
  ["Guardados", "Os anúncios que guardou.", "/guardados"],
  ["Conta", "Perfil, segurança e privacidade.", "/conta"]
];

export default function Home() {
  const router = useRouter();
  return (
    <ScrollView contentContainerStyle={ui.screen}>
      <View style={styles.top}><Text style={styles.eyebrow}>HUAMBO ONLINE</Text><View style={{ flexDirection: "row" }}><NotificationBell /></View></View>
      <Text style={ui.h1}>Tudo o que o Huambo tem para oferecer.</Text>
      <Text style={ui.text}>Negócios, profissionais, produtos, serviços e classificados num único lugar.</Text>
      <Button title="+ Publicar anúncio" onPress={() => router.push("/classificados/publicar" as any)} />
      <View style={{ gap: 12 }}>
        {modules.map(([title, description, href]) => (
          <Link key={href} href={href as any} style={ui.card}>
            <Text style={ui.h2}>{title}{"\n"}</Text>
            <Text style={ui.muted}>{description}</Text>
          </Link>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 18 }}>
        <Link href="/login" style={ui.link}>Entrar</Link>
        <Link href="/criar-conta" style={ui.link}>Criar conta</Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { fontSize: 14, fontWeight: "800", letterSpacing: 1, color: "#111" }
});
