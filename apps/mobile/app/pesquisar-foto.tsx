import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { analyzePhoto, photoSearchesLeft, photoSearchMessage, searchByKeywords, fitWithin, formatPrice, timeAgo,
  PHOTO_SEARCH_DAILY_LIMIT, PURPOSE_LABELS, type PhotoSearchResult, listingPriceLabel, isFeatured } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { ui, C } from "../lib/ui";
import { Button, Message } from "../components/Ui";
import { ItemCard, Grid, LISTING_ICON } from "../components/ItemCard";

export default function PesquisarFoto() {
  const router = useRouter();
  const { width } = useWindowDimensions(); const cardW = (width - 32 - 14) / 2;
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [left, setLeft] = useState<number | null>(null);
  const [preview, setPreview] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [result, setResult] = useState<PhotoSearchResult | null>(null);
  const [items, setItems] = useState<{ listings: any[]; products: any[] } | null>(null);

  useFocusEffect(useCallback(() => { void currentUserId().then(async id => { setUid(id); if (id) setLeft(await photoSearchesLeft(supabase())); }); }, []));

  async function pick(fromCamera: boolean) {
    setError("");
    const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError(fromCamera ? "Autorize o uso da câmara." : "Autorize o acesso à galeria."); return; }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1 };
    const r = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    setResult(null); setItems(null); setBusy(true);
    try {
      // Reduz para 1024 px (JPEG) antes de enviar: poupa dados móveis e custa menos.
      const size = fitWithin(a.width || 1024, a.height || 1024);
      const small = await manipulateAsync(a.uri, [{ resize: size }], { compress: 0.75, format: SaveFormat.JPEG, base64: true });
      setPreview(small.uri);
      const res = await analyzePhoto(supabase(), small.base64 ?? "", "image/jpeg");
      if (res.error || !res.data) { setError(photoSearchMessage(res.error ?? "PHOTO_SEARCH_FAILED")); return; }
      setResult(res.data); setLeft(res.data.remaining);
      if (res.data.found) setItems(await searchByKeywords(supabase(), res.data.keywords));
    } catch { setError(photoSearchMessage("INVALID_IMAGE")); }
    finally { setBusy(false); }
  }

  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <View style={ui.screen}>
    <Text style={ui.h1}>📷 Pesquisar por fotografia</Text>
    <Text style={ui.text}>Tire uma fotografia de um artigo e encontramos anúncios e produtos parecidos no Huambo Online.</Text>
    <Button title="Entrar para pesquisar" onPress={() => router.push("/login")} />
  </View>;

  const total = items ? items.listings.length + items.products.length : 0;
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/" style={ui.link}>← Início</Link>
    <Text style={ui.h1}>📷 Pesquisar por fotografia</Text>
    <Text style={ui.text}>Fotografe um artigo (telemóvel, sapatos, cimento, uma viatura…) e mostramos o que há à venda no Huambo Online.</Text>
    <Button title={busy ? "A analisar a fotografia…" : "📷 Tirar fotografia"} disabled={busy || left === 0} onPress={() => void pick(true)} />
    <Button title="🖼️ Escolher da galeria" variant="secondary" disabled={busy || left === 0} onPress={() => void pick(false)} />
    <Text style={ui.muted}>{left === null ? "" : `Restam ${left} de ${PHOTO_SEARCH_DAILY_LIMIT} pesquisas por fotografia hoje. `}A fotografia não fica guardada.</Text>
    <Message error={error} />
    {!!preview && <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
      <Image source={{ uri: preview }} style={{ width: 110, height: 110, borderRadius: 12, backgroundColor: C.surface }} accessibilityLabel="A sua fotografia" />
      {!!result && <View style={{ flex: 1, gap: 8 }}>
        {result.found ? <>
          <Text style={ui.h2}>Parece ser: {result.label}</Text>
          <View style={ui.row}>{result.keywords.map(k => <Pressable key={k} accessibilityRole="link" onPress={() => router.push(("/explorar?q=" + encodeURIComponent(k)) as any)} style={ui.chip}><Text style={ui.chipText}>🔍 {k}</Text></Pressable>)}</View>
        </> : <Text style={ui.label}>Não conseguimos reconhecer um artigo nesta fotografia. Tente outra, mais perto e com boa luz.</Text>}
      </View>}
    </View>}
    {!!items && <>
      <Text style={ui.h2}>{total ? `${total} resultado(s)` : "Ainda não há nada parecido à venda."}</Text>
      <Grid>
        {items.listings.map(x => <ItemCard key={x.id} featured={isFeatured(x)} width={cardW} video={!!x.video_url} href={"/classificados/" + x.id} media={x.media} title={x.title} price={listingPriceLabel(x)}
          icon={LISTING_ICON[x.listing_type] ?? "🏷️"} tag={x.purpose === "auction" ? "Leilão" : x.purpose !== "sale" ? PURPOSE_LABELS[x.purpose as keyof typeof PURPOSE_LABELS] : undefined} tagRed={x.purpose === "auction"} meta={timeAgo(x.created_at)} />)}
        {items.products.map(p => <ItemCard key={p.id} width={cardW} href={"/loja/" + p.id} media={p.media} title={p.name} price={formatPrice(p.price, p.currency)} tag="Loja" meta={[p.seller_name, p.municipality_name].filter(Boolean).join(" · ")} />)}
      </Grid>
    </>}
  </ScrollView>;
}
