import { useEffect, useState } from "react";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Image, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { getProduct, addToMyCart, getPublicProfile, formatPrice, friendlyError } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";
import { ui } from "../../lib/ui";
import { Button, Message } from "../../components/Ui";

export default function Produto() {
  const router = useRouter(); const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [p, setP] = useState<any>(null); const [seller, setSeller] = useState(""); const [uid, setUid] = useState<string | null>(null);
  const [qty, setQty] = useState("1"); const [photo, setPhoto] = useState(0); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!id) return; void (async () => {
    const c = supabase(); const r = await getProduct(c, id);
    if (r.error) { setError(friendlyError(r.error)); return; }
    if (!r.data) { setError("Produto não encontrado."); return; }
    setP(r.data);
    const s = await getPublicProfile(c, r.data.seller_id); if (s.data?.full_name) setSeller(s.data.full_name);
    const u = await c.auth.getUser(); setUid(u.data.user?.id ?? null);
  })(); }, [id]);
  async function add() {
    if (!uid) { router.push("/login"); return; }
    setBusy(true); setError(""); setNotice("");
    const n = Math.max(1, Math.min(p.stock, Number(qty) || 1));
    const r = await addToMyCart(supabase(), id, n); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else setNotice("Adicionado ao carrinho.");
  }
  if (error && !p) return <View style={ui.screen}><Link href={"/loja" as any} style={ui.link}>← Loja</Link><Text style={ui.error}>{error}</Text></View>;
  if (!p) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  const media: string[] = Array.isArray(p.media) ? p.media : [];
  const mine = uid === p.seller_id;
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href={"/loja" as any} style={ui.link}>← Loja</Link>
    <Text style={ui.h1}>{p.name}</Text>
    <Text style={ui.price}>{formatPrice(p.price, p.currency)}</Text>
    <Text style={ui.muted}>{p.stock > 0 ? `${p.stock} em stock` : "Esgotado"} · {[p.categories?.name, p.municipalities?.name].filter(Boolean).join(" · ")}</Text>
    {!!seller && <Text style={ui.text}>Vendedor: {seller}</Text>}
    {media.length > 0 && <View style={{ gap: 8 }}>
      <Image source={{ uri: media[photo] }} style={{ width: width - 40, height: (width - 40) * 0.75, borderRadius: 12, backgroundColor: "#eee" }} resizeMode="contain" />
      {media.length > 1 && <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{media.map((m, i) => <Pressable key={m} onPress={() => setPhoto(i)} style={{ borderWidth: 3, borderColor: i === photo ? "#111" : "transparent", borderRadius: 8 }}><Image source={{ uri: m }} style={{ width: 68, height: 68, borderRadius: 6 }} /></Pressable>)}</ScrollView>}
    </View>}
    {!!p.description && <Text style={ui.text}>{p.description}</Text>}
    <Message error={error} ok={notice} />
    {!!notice && <Button title="Ver carrinho" variant="secondary" onPress={() => router.push("/carrinho" as any)} />}
    {mine ? <Button title="Gerir os meus produtos" onPress={() => router.push("/conta/produtos" as any)} /> : p.stock > 0 && <View style={{ gap: 8 }}>
      <Text style={ui.label}>Quantidade</Text>
      <TextInput style={ui.input} keyboardType="number-pad" value={qty} onChangeText={setQty} />
      <Button title="🛒 Adicionar ao carrinho" disabled={busy} onPress={() => void add()} />
    </View>}
  </ScrollView>;
}
