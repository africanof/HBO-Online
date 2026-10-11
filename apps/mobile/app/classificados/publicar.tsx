import { useEffect, useState } from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { ListingForm } from "../../components/ListingForm";
import { currentUserId } from "../../lib/supabase";
import { ui } from "../../lib/ui";

export default function Publicar() {
  const params = useLocalSearchParams<{ finalidade?: string; modo?: string }>();
  const wanted = params.finalidade === "wanted";
  const [user, setUser] = useState<string | null | undefined>(undefined);
  useEffect(() => { void currentUserId().then(setUser).catch(() => setUser(null)); }, []);
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/" style={ui.link}>← Huambo Online</Link>
    <Text style={ui.h1}>{wanted ? "🔎 Publicar o que procuro" : "Publicar anúncio"}</Text>
    {!wanted && <Link href={"/classificados/publicar?finalidade=wanted" as any} style={ui.link}>Quer comprar? Publique o que procura →</Link>}
    {user === undefined && <Text style={ui.text}>A carregar…</Text>}
    {user === null && <View style={{ gap: 10 }}><Text style={ui.text}>Para publicar, inicie sessão ou crie uma conta.</Text><Link href="/login" style={ui.link}>Entrar</Link><Link href="/criar-conta" style={ui.link}>Criar conta</Link></View>}
    {!!user && <ListingForm key={(wanted ? "w" : "s") + (params.modo ?? "")} initialPurpose={wanted ? "wanted" : undefined} initialSaleMode={params.modo} />}
  </ScrollView>;
}
