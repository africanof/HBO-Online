import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { analyzePhoto, photoSearchesLeft, photoSearchMessage, searchByKeywords, fitWithin, formatPrice,
  PHOTO_SEARCH_DAILY_LIMIT, PURPOSE_LABELS, type PhotoSearchResult, listingPriceLabel, isFeatured } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { ui, C } from "../lib/ui";
import { Button, Message } from "../components/Ui";
import { ItemCard, Grid, LISTING_ICON } from "../components/ItemCard";
import { useT, coreText, timeAgoIn } from "../lib/i18n";

export default function PesquisarFoto() {
  const router = useRouter(); const { t, tc, lang } = useT();
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
    if (!perm.granted) { setError(fromCamera ? t("ls.photo.perm_camera") : t("ls.photo.perm_gallery")); return; }
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
      if (res.error || !res.data) { setError(tc(photoSearchMessage(res.error ?? "PHOTO_SEARCH_FAILED"))); return; }
      setResult(res.data); setLeft(res.data.remaining);
      if (res.data.found) setItems(await searchByKeywords(supabase(), res.data.keywords));
    } catch { setError(tc(photoSearchMessage("INVALID_IMAGE"))); }
    finally { setBusy(false); }
  }

  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></View>;
  if (!uid) return <View style={ui.screen}>
    <Text style={ui.h1}>📷 {t("search.photo")}</Text>
    <Text style={ui.text}>{t("ls.photo.intro_guest")}</Text>
    <Button title={t("ls.photo.sign_in")} onPress={() => router.push("/login")} />
  </View>;

  const total = items ? items.listings.length + items.products.length : 0;
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/" style={ui.link}>← {t("nav.home")}</Link>
    <Text style={ui.h1}>📷 {t("search.photo")}</Text>
    <Text style={ui.text}>{t("ls.photo.intro")}</Text>
    <Button title={busy ? t("ls.photo.analysing") : t("ls.photo.take")} disabled={busy || left === 0} onPress={() => void pick(true)} />
    <Button title={t("ls.photo.gallery")} variant="secondary" disabled={busy || left === 0} onPress={() => void pick(false)} />
    <Text style={ui.muted}>{left === null ? "" : t("ls.photo.left", { n: left, max: PHOTO_SEARCH_DAILY_LIMIT }) + " "}{t("ls.photo.not_kept")}</Text>
    <Message error={error} />
    {!!preview && <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
      <Image source={{ uri: preview }} style={{ width: 110, height: 110, borderRadius: 12, backgroundColor: C.surface }} accessibilityLabel={t("ls.photo.yours")} />
      {!!result && <View style={{ flex: 1, gap: 8 }}>
        {result.found ? <>
          <Text style={ui.h2}>{t("ls.photo.looks_like", { label: result.label })}</Text>
          <View style={ui.row}>{result.keywords.map(k => <Pressable key={k} accessibilityRole="link" onPress={() => router.push(("/explorar?q=" + encodeURIComponent(k)) as any)} style={ui.chip}><Text style={ui.chipText}>🔍 {k}</Text></Pressable>)}</View>
        </> : <Text style={ui.label}>{t("ls.photo.not_found")}</Text>}
      </View>}
    </View>}
    {!!items && <>
      <Text style={ui.h2}>{total ? t("ls.explore.results", { n: total }) : t("ls.photo.nothing")}</Text>
      <Grid>
        {items.listings.map(x => <ItemCard save={{ kind: "listing", id: x.id }} key={x.id} featured={isFeatured(x)} width={cardW} video={!!x.video_url} href={"/classificados/" + x.id} media={x.media} title={x.title} price={tc(coreText(listingPriceLabel(x), t) ?? "")}
          icon={LISTING_ICON[x.listing_type] ?? "🏷️"} tag={x.purpose === "auction" ? t("tag.auction") : x.purpose !== "sale" ? coreText(tc(PURPOSE_LABELS[x.purpose as keyof typeof PURPOSE_LABELS]), t) : undefined} tagRed={x.purpose === "auction"} meta={timeAgoIn(x.created_at, t, lang)} />)}
        {items.products.map(p => <ItemCard save={{ kind: "product", id: p.id }} key={p.id} width={cardW} href={"/loja/" + p.id} media={p.media} title={p.name} price={formatPrice(p.price, p.currency)} tag={t("nav.shop")} meta={[p.seller_name, p.municipality_name].filter(Boolean).join(" · ")} />)}
      </Grid>
    </>}
  </ScrollView>;
}
