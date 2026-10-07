import { useEffect, useState } from "react";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Image, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { getClassifiedListing, contactListingOwner, isClassifiedListingSaved, saveClassifiedListing, removeClassifiedListing,
  reportClassifiedListing, formatPrice, friendlyError, listingTerritory, LISTING_TYPE_LABELS, PURPOSE_LABELS, STATUS_LABELS } from "@huambo-online/core";
import { supabase } from "../../../lib/supabase";
import { ui } from "../../../lib/ui";
import { Button, Message } from "../../../components/Ui";

export default function ClassifiedDetail() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<any>(null);
  const [place, setPlace] = useState("");
  const [uid, setUid] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(0);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const c = supabase();
      const r = await getClassifiedListing(c, id);
      if (r.error) { setError(friendlyError(r.error)); return; }
      if (!r.data) { setError("Anúncio não encontrado ou já não está publicado."); return; }
      setItem(r.data);
      const t = listingTerritory(r.data);
      if (t.municipalityId) {
        const m = await c.from("municipalities").select("name,provinces(name)").eq("id", t.municipalityId).maybeSingle();
        if (m.data) setPlace(m.data.name + ((m.data as any).provinces?.name ? ", " + (m.data as any).provinces.name : ""));
      }
      const u = await c.auth.getUser();
      if (u.data.user) {
        setUid(u.data.user.id);
        const s = await isClassifiedListingSaved(c, u.data.user.id, id);
        if (s.data) setSavedId(s.data.id);
      }
    })();
  }, [id]);

  async function toggleSaved() {
    if (!uid) { setError("Inicie sessão para guardar este anúncio."); return; }
    setBusy(true);
    const c = supabase();
    const r = savedId ? await removeClassifiedListing(c, uid, id) : await saveClassifiedListing(c, uid, id);
    setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else setSavedId(savedId ? null : (r.data as any)?.id ?? "saved");
  }

  async function contact() {
    if (!uid) { setError("Inicie sessão para contactar o anunciante."); return; }
    if (!message.trim() || busy) return;
    setBusy(true); setError("");
    const r = await contactListingOwner(supabase(), id, message);
    setBusy(false);
    if (r.error) { setError(friendlyError(r.error)); return; }
    setMessage("");
    const conversationId = (r.data as any)?.id;
    if (conversationId) router.push(("/mensagens?conversation=" + conversationId) as any); else setNotice("Mensagem enviada.");
  }

  async function report() {
    if (!uid) { setError("Inicie sessão para denunciar."); return; }
    if (!reason.trim()) { setError("Indique o motivo da denúncia."); return; }
    const r = await reportClassifiedListing(supabase(), id, reason);
    if (r.error) setError(friendlyError(r.error)); else { setNotice("Denúncia enviada. Obrigado."); setReporting(false); setReason(""); }
  }

  if (error && !item) return <View style={ui.screen}><Link href="/explorar" style={ui.link}>← Explorar</Link><Text style={ui.error}>{error}</Text></View>;
  if (!item) return <View style={ui.screen}><Text style={ui.text}>A carregar anúncio…</Text></View>;
  const media: string[] = Array.isArray(item.media) ? item.media : [];
  const mine = uid === item.owner_id;

  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/explorar" style={ui.link}>← Explorar</Link>
    {item.status !== "published" && <Text style={ui.error}>{STATUS_LABELS[item.status as keyof typeof STATUS_LABELS] ?? item.status} — só você vê este anúncio</Text>}
    <Text style={ui.h1}>{item.title}</Text>
    <Text style={ui.price}>{formatPrice(item.price, item.currency)}</Text>
    <Text style={ui.text}>{LISTING_TYPE_LABELS[item.listing_type as keyof typeof LISTING_TYPE_LABELS] ?? item.listing_type} · {PURPOSE_LABELS[item.purpose as keyof typeof PURPOSE_LABELS] ?? item.purpose}{place ? " · 📍 " + place : ""}</Text>
    {media.length > 0 && <View style={{ gap: 8 }}>
      <Image source={{ uri: media[photo] }} style={{ width: width - 40, height: (width - 40) * 0.75, borderRadius: 12, backgroundColor: "#eee" }} resizeMode="contain" accessibilityLabel={`Fotografia ${photo + 1} de ${media.length}`} />
      {media.length > 1 && <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{media.map((m, i) => <Pressable key={m} onPress={() => setPhoto(i)} accessibilityLabel={`Ver fotografia ${i + 1}`} style={{ borderWidth: 3, borderColor: i === photo ? "#111" : "transparent", borderRadius: 8 }}><Image source={{ uri: m }} style={{ width: 68, height: 68, borderRadius: 6 }} /></Pressable>)}</ScrollView>}
    </View>}
    {!!item.description && <Text style={ui.text}>{item.description}</Text>}
    <Message error={error} ok={notice} />
    {mine ? <View style={{ gap: 10 }}>
      <Button title="Editar anúncio" onPress={() => router.push(`/classificados/${id}/editar` as any)} />
      <Button title="Os meus anúncios" variant="secondary" onPress={() => router.push("/meus-anuncios" as any)} />
    </View> : <View style={{ gap: 12 }}>
      <Button title={savedId ? "★ Guardado" : "☆ Guardar anúncio"} variant="secondary" onPress={() => void toggleSaved()} disabled={busy} />
      <View style={ui.card}>
        <Text style={ui.h2}>Contactar anunciante</Text>
        <TextInput value={message} onChangeText={setMessage} placeholder="Olá, o anúncio ainda está disponível?" multiline style={[ui.input, ui.area]} />
        <Button title={busy ? "A enviar…" : "Enviar mensagem"} onPress={() => void contact()} disabled={busy || !message.trim()} />
      </View>
      {!reporting ? <Button title="Denunciar anúncio" variant="secondary" onPress={() => setReporting(true)} /> : <View style={ui.card}>
        <Text style={ui.label}>Motivo da denúncia</Text>
        <TextInput value={reason} onChangeText={setReason} multiline style={[ui.input, ui.area]} placeholder="Ex.: fraude, conteúdo proibido…" />
        <Button title="Enviar denúncia" variant="danger" onPress={() => void report()} />
        <Button title="Cancelar" variant="secondary" onPress={() => setReporting(false)} />
      </View>}
    </View>}
  </ScrollView>;
}
