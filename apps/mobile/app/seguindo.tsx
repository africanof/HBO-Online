import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { listMyFollows, toggleFollow, followHref, friendlyError, FOLLOW_KIND_LABELS, type MyFollow } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Message } from "../components/Ui";
import { LiteImage } from "../components/LiteImage";

export default function Seguindo() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<MyFollow[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listMyFollows(supabase()); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []));
  async function stop(f: MyFollow) {
    const r = await toggleFollow(supabase(), f.kind, f.id);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(`Deixou de seguir «${f.name}».`); await load(); }
  }
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <View style={ui.screen}><Text style={ui.h1}>A seguir</Text><Button title="Entrar" onPress={() => router.push("/login")} /></View>;
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/conta" style={ui.link}>← A sua conta</Link>
    <Text style={ui.h1}>👥 A seguir</Text>
    <Text style={ui.text}>Recebe um aviso quando estes profissionais, empresas e lojas publicam algo novo.</Text>
    <Message error={error} ok={notice} />
    {items.length === 0 && <Text style={ui.text}>Ainda não segue ninguém. Abra a página de um profissional, de uma empresa ou de um vendedor e toque em «➕ Seguir».</Text>}
    {items.map(f => <View key={f.kind + f.id} style={ui.card}>
      <View style={[ui.row, { alignItems: "center", flexWrap: "nowrap" }]}>
        {f.picture ? <LiteImage placeholder={f.kind === "business" ? "🏪" : "👤"} source={{ uri: f.picture }} style={{ width: 56, height: 56, borderRadius: f.kind === "business" ? 12 : 28 }} />
          : <Text style={{ fontSize: 40 }}>{f.kind === "business" ? "🏪" : f.kind === "provider" ? "🧰" : "👤"}</Text>}
        <View style={{ flex: 1 }}><Text style={ui.h2}>{f.name}</Text><Text style={ui.muted}>{FOLLOW_KIND_LABELS[f.kind]}{f.detail ? " · " + f.detail : ""}</Text></View>
      </View>
      <Button title="Ver" variant="secondary" onPress={() => router.push(followHref(f.kind, f.id) as any)} />
      <Button title="Deixar de seguir" variant="secondary" onPress={() => void stop(f)} />
    </View>)}
  </ScrollView>;
}
