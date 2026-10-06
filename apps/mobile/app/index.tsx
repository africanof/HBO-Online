import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const modules = [
  ["Explorar", "Pesquisar produtos, serviços e classificados.", "/explorar"],
  ["Classificados", "Anúncios de compra, venda e aluguer.", "/classificados"],
  ["Mensagens", "Converse com empresas, profissionais e anunciantes.", "/mensagens"],
  ["Notificações", "Acompanhe alertas e novidades.", "/notificacoes"],
  ["Pesquisas guardadas", "Guarde pesquisas e receba alertas.", "/pesquisas-guardadas"],
  ["Guardados", "Veja os anúncios que guardou.", "/guardados"],
  ["Conta", "Gerir perfil e atividades.", "/conta"],
];

export default function Home() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>HUAMBO ONLINE</Text>
      <Text style={styles.title}>Tudo o que o Huambo tem para oferecer.</Text>
      <Text style={styles.body}>Negócios, profissionais, produtos, serviços, marketplace e logística num único ecossistema.</Text>
      <View style={styles.grid}>
        {modules.map(([title,description,href]) => (
          <Link key={href} href={href as any} style={styles.card}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardText}>{description}</Text>
          </Link>
        ))}
      </View>
      <View style={styles.authRow}>
        <Link href="/login" style={styles.auth}>Entrar</Link>
        <Link href="/criar-conta" style={styles.auth}>Criar conta</Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:{padding:24,paddingTop:54,gap:14},
  eyebrow:{fontSize:13,fontWeight:"800",letterSpacing:1},
  title:{fontSize:34,fontWeight:"800",lineHeight:40},
  body:{fontSize:17,lineHeight:25},
  grid:{gap:12,marginTop:12},
  card:{borderWidth:1,borderColor:"#ddd",borderRadius:16,padding:18,gap:7},
  cardTitle:{fontSize:19,fontWeight:"800"},
  cardText:{fontSize:15,lineHeight:21},
  authRow:{flexDirection:"row",gap:18,marginTop:10},
  auth:{fontWeight:"800"}
});
