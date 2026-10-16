import { useEffect, useState } from "react";
import { Link, useRouter } from "expo-router";
import { Alert, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { getProvider, saveMyProviderProfile, setProviderPhoto, listProviderServices, saveService, deleteService, listDirectoryCategories, friendlyErrorIn, parsePrice, formatPrice, OTHER_CATEGORY, categoryFormValues, pointFrom, type GeoPoint } from "@huambo-online/core";
import { PlaceFields } from "../../components/Place";
import { supabase, currentUserId } from "../../lib/supabase";
import { ui } from "../../lib/ui";
import { Button, Chips, Message } from "../../components/Ui";
import { useTerritory } from "../../components/Directory";
import { PhotoPicker, PortfolioManager } from "../../components/Portfolio";
import { PlanBanner } from "../../components/Plans";
import { useT } from "../../lib/i18n";

type Option = { id: string; name: string };
const empty = { displayName: "", headline: "", bio: "", categoryId: "", customCategory: "", municipalityId: "", phone: "", whatsapp: "", active: true, directions: "", point: null as GeoPoint | null };

export default function PerfilProfissional() {
  const router = useRouter(); const { t, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [form, setForm] = useState(empty); const [exists, setExists] = useState(false); const [avatar, setAvatar] = useState<string | null>(null);
  const [services, setServices] = useState<any[]>([]); const [svc, setSvc] = useState({ title: "", description: "", price: "" });
  const [categories, setCategories] = useState<Option[]>([]); const { provinces, municipalities, provinceId, setProvinceId } = useTerritory();
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);

  async function load(id: string) {
    const c = supabase();
    const p = await getProvider(c, id);
    if (p.data) { setExists(true); setAvatar(p.data.avatar_url ?? null); setForm({ displayName: p.data.display_name ?? "", headline: p.data.headline ?? "", bio: p.data.bio ?? "", ...categoryFormValues(p.data), municipalityId: p.data.municipality_id ?? "", phone: p.data.phone ?? "", whatsapp: p.data.whatsapp ?? "", active: p.data.active, directions: p.data.directions ?? "", point: pointFrom(p.data.geo_lat, p.data.geo_lng) }); }
    const s = await listProviderServices(c, id, true); setServices(s.data ?? []);
  }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(id); }); void listDirectoryCategories(supabase(), "providers").then(({ data }) => setCategories(data ?? [])); }, []);
  const set = (k: keyof typeof empty) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  async function run(fn: () => PromiseLike<{ error: any }>, ok: string) {
    setBusy(true); setError(""); setNotice("");
    const r = await fn(); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(ok); if (uid) await load(uid); }
    return !r.error;
  }

  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></View>;
  if (!uid) return <View style={ui.screen}><Link href="/profissionais" style={ui.link}>{t("sv.prov_back")}</Link><Text style={ui.h1}>{t("sv.pro_profile")}</Text><Text style={ui.text}>{t("sv.pro_login")}</Text><Button title={t("auth.login")} onPress={() => router.push("/login")} /></View>;

  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>{t("sv.account_back_short")}</Link>
    <Text style={ui.h1}>{exists ? t("sv.pro_mine") : t("sv.pro_create_title")}</Text>
    <Text style={ui.text}>{t("sv.pro_intro")}</Text>
    {exists && <Button title={t("sv.pro_public")} variant="secondary" onPress={() => router.push(("/profissionais/" + uid) as any)} />}
    <Message error={error} ok={notice} />
    <View style={ui.card}>
      <Text style={ui.label}>{t("sv.pro_name")}</Text><TextInput style={ui.input} value={form.displayName} onChangeText={set("displayName")} placeholder={t("sv.pro_name_ph")} />
      <Text style={ui.label}>{t("sv.pro_headline")}</Text><TextInput style={ui.input} value={form.headline} onChangeText={set("headline")} placeholder={t("sv.pro_headline_ph")} />
      <Text style={ui.label}>{t("sv.pro_bio")}</Text><TextInput style={[ui.input, ui.area]} multiline value={form.bio} onChangeText={set("bio")} />
      <Text style={ui.label}>{t("sv.pro_area")}</Text><Chips options={[...categories.map(c => ({ value: c.id, label: c.name })), { value: OTHER_CATEGORY, label: t("sv.other_category") }]} value={form.categoryId} onChange={set("categoryId")} />
      {form.categoryId === OTHER_CATEGORY && <><Text style={ui.label}>{t("sv.which_activity")}</Text><TextInput style={ui.input} value={form.customCategory} onChangeText={set("customCategory")} maxLength={60} placeholder={t("sv.activity_ph")} autoFocus /></>}
      <Text style={ui.label}>{t("sv.province")}</Text><Chips options={provinces.map(p => ({ value: p.id, label: p.name }))} value={provinceId} onChange={v => { setProvinceId(v); set("municipalityId")(""); }} />
      <Text style={ui.label}>{t("sv.municipality")}</Text><Chips options={municipalities.map(m => ({ value: m.id, label: m.name }))} value={form.municipalityId} onChange={set("municipalityId")} />
      <Text style={ui.label}>{t("sv.phone")}</Text><TextInput style={ui.input} keyboardType="phone-pad" value={form.phone} onChangeText={set("phone")} />
      <Text style={ui.label}>WhatsApp</Text><TextInput style={ui.input} keyboardType="phone-pad" value={form.whatsapp} onChangeText={set("whatsapp")} />
      <PlaceFields directions={form.directions} point={form.point} onDirections={v => setForm({ ...form, directions: v })} onPoint={p => setForm({ ...form, point: p })} hint={t("sv.pro_place_hint")} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={ui.label}>{t("sv.pro_visible")}</Text><Switch value={form.active} onValueChange={v => setForm(f => ({ ...f, active: v }))} /></View>
      <Button title={exists ? t("sv.pro_save") : t("sv.pro_create")} disabled={busy} onPress={() => void run(() => saveMyProviderProfile(supabase(), uid, form), t("sv.pro_saved"))} />
    </View>
    {exists && <View style={{ gap: 10 }}>
      <PlanBanner kind="provider" subjectId={uid} />
      <Text style={ui.h2}>{t("sv.pro_photo")}</Text>
      <PhotoPicker uid={uid} current={avatar} label={t("sv.photo")} onSave={url => setProviderPhoto(supabase(), uid, url)} />
      <PortfolioManager uid={uid} target={{ providerId: uid }} />
      <Text style={ui.h2}>{t("sv.my_services")}</Text>
      <View style={ui.card}>
        <Text style={ui.label}>{t("sv.service")}</Text><TextInput style={ui.input} value={svc.title} onChangeText={v => setSvc({ ...svc, title: v })} />
        <Text style={ui.label}>{t("sv.description")}</Text><TextInput style={ui.input} value={svc.description} onChangeText={v => setSvc({ ...svc, description: v })} />
        <Text style={ui.label}>{t("sv.price_from_kz")}</Text><TextInput style={ui.input} keyboardType="decimal-pad" value={svc.price} onChangeText={v => setSvc({ ...svc, price: v })} placeholder={t("sv.price_empty_ph")} />
        <Button title={t("sv.add_service")} disabled={busy} onPress={() => void run(() => saveService(supabase(), uid, { title: svc.title, description: svc.description, priceFrom: parsePrice(svc.price), categoryId: form.categoryId === OTHER_CATEGORY ? undefined : form.categoryId }), t("sv.service_added")).then(ok => { if (ok) setSvc({ title: "", description: "", price: "" }); })} />
      </View>
      {services.map(s => <View key={s.id} style={ui.card}>
        <Text style={ui.label}>{s.title}</Text>
        <Text style={ui.text}>{s.price_from != null ? t("sv.price_from_lower", { price: formatPrice(s.price_from, s.currency) }) : t("sv.on_request")}</Text>
        <Button title={t("common.delete")} variant="danger" onPress={() => Alert.alert(t("sv.delete_service"), t("sv.are_you_sure"), [{ text: t("common.cancel"), style: "cancel" }, { text: t("common.delete"), style: "destructive", onPress: () => void run(() => deleteService(supabase(), s.id), t("sv.service_deleted")) }])} />
      </View>)}
    </View>}
  </ScrollView>;
}
