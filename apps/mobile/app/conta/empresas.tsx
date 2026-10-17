import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "expo-router";
import { Alert, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { listMyBusinesses, saveBusiness, setBusinessLogo, deleteBusiness, listDirectoryCategories, friendlyErrorIn, OTHER_CATEGORY, categoryFormValues, pointFrom, type GeoPoint } from "@huambo-online/core";
import { PlaceFields } from "../../components/Place";
import { supabase, currentUserId } from "../../lib/supabase";
import { ui } from "../../lib/ui";
import { MarketPicker } from "../../components/MarketPicker";
import { Button, Chips, Message } from "../../components/Ui";
import { useTerritory } from "../../components/Directory";
import { PhotoPicker, PortfolioManager } from "../../components/Portfolio";
import { PlanBanner } from "../../components/Plans";
import { ProfileQr } from "../../components/ProfileQr";
import { useT } from "../../lib/i18n";

type Option = { id: string; name: string };
const empty = { name: "", description: "", categoryId: "", customCategory: "", municipalityId: "", marketId: "", phone: "", whatsapp: "", addressText: "", active: true, directions: "", point: null as GeoPoint | null };

export default function MinhasEmpresas() {
  const router = useRouter(); const { t, lang } = useT();
  const scroll = useRef<ScrollView>(null);
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<any[]>([]); const [form, setForm] = useState(empty); const [editing, setEditing] = useState<string | null>(null); const [showcase, setShowcase] = useState<string | null>(null);
  const [categories, setCategories] = useState<Option[]>([]); const { provinces, municipalities, provinceId, setProvinceId } = useTerritory();
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);

  async function load(id: string) { const r = await listMyBusinesses(supabase(), id); setItems(r.data ?? []); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(id); }); void listDirectoryCategories(supabase(), "businesses").then(({ data }) => setCategories(data ?? [])); }, []);
  const set = (k: keyof typeof empty) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  async function submit() {
    if (!uid) return;
    setBusy(true); setError(""); setNotice("");
    const r = await saveBusiness(supabase(), uid, form, editing ?? undefined); setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    setNotice(editing ? t("sv.biz_updated") : t("sv.biz_registered")); setForm(empty); setEditing(null); await load(uid);
  }

  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></View>;
  if (!uid) return <View style={ui.screen}><Link href="/empresas" style={ui.link}>{t("sv.biz_back")}</Link><Text style={ui.h1}>{t("sv.biz_mine")}</Text><Text style={ui.text}>{t("sv.biz_login")}</Text><Button title={t("auth.login")} onPress={() => router.push("/login")} /></View>;

  return <ScrollView ref={scroll} contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>{t("sv.account_back_short")}</Link>
    <Text style={ui.h1}>{t("sv.biz_mine")}</Text>
    <Button title={t("sv.stats")} variant="secondary" onPress={() => router.push("/conta/estatisticas" as any)} />
    <Message error={error} ok={notice} />
    {items.map(b => <View key={b.id} style={ui.card}>
      <Text style={ui.h2}>{b.name}{b.verified ? " ✔️" : ""}{b.active ? "" : t("sv.hidden_f")}</Text>
      <PlanBanner kind="business" subjectId={b.id} />
      <Button title={t("sv.view")} variant="secondary" onPress={() => router.push(("/empresas/" + b.id) as any)} />
      <ProfileQr kind="empresas" id={b.id} name={b.name ?? ""} hint={t("sv.qr.print_hint")} />
      <Button title={t("sv.logo_portfolio")} variant={showcase === b.id ? "primary" : "secondary"} onPress={() => setShowcase(showcase === b.id ? null : b.id)} />
      {showcase === b.id && <View style={{ gap: 10 }}>
        <Text style={ui.label}>{t("sv.logo")}</Text>
        <PhotoPicker uid={uid} current={b.logo_url ?? null} label={t("sv.logo")} onSave={url => setBusinessLogo(supabase(), b.id, url)} />
        <PortfolioManager uid={uid} target={{ businessId: b.id }} />
      </View>}
      <Button title={t("common.edit")} variant="secondary" onPress={() => { setEditing(b.id); setForm({ name: b.name ?? "", description: b.description ?? "", ...categoryFormValues(b), municipalityId: b.municipality_id ?? "", marketId: b.market_id ?? "", phone: b.phone ?? "", whatsapp: b.whatsapp ?? "", addressText: b.address_text ?? "", active: b.active, directions: b.directions ?? "", point: pointFrom(b.geo_lat, b.geo_lng) }); scroll.current?.scrollToEnd(); }} />
      <Button title={t("common.delete")} variant="danger" onPress={() => Alert.alert(t("sv.biz_delete"), t("sv.are_you_sure"), [{ text: t("common.cancel"), style: "cancel" }, { text: t("common.delete"), style: "destructive", onPress: async () => { const r = await deleteBusiness(supabase(), b.id); if (r.error) setError(friendlyErrorIn(r.error, lang)); else await load(uid); } }])} />
    </View>)}
    <View style={ui.card}>
      <Text style={ui.h2}>{editing ? t("sv.biz_edit") : t("sv.biz_register")}</Text>
      <Text style={ui.label}>{t("sv.name")}</Text><TextInput style={ui.input} value={form.name} onChangeText={set("name")} />
      <Text style={ui.label}>{t("sv.description")}</Text><TextInput style={[ui.input, ui.area]} multiline value={form.description} onChangeText={set("description")} />
      <Text style={ui.label}>{t("sv.category")}</Text><Chips options={[...categories.map(c => ({ value: c.id, label: c.name })), { value: OTHER_CATEGORY, label: t("sv.other_category") }]} value={form.categoryId} onChange={set("categoryId")} />
      {form.categoryId === OTHER_CATEGORY && <><Text style={ui.label}>{t("sv.which_activity")}</Text><TextInput style={ui.input} value={form.customCategory} onChangeText={set("customCategory")} maxLength={60} placeholder={t("sv.activity_ph")} autoFocus /></>}
      <Text style={ui.label}>{t("sv.province")}</Text><Chips options={provinces.map(p => ({ value: p.id, label: p.name }))} value={provinceId} onChange={v => { setProvinceId(v); set("municipalityId")(""); }} />
      <Text style={ui.label}>{t("sv.municipality")}</Text><Chips options={municipalities.map(m => ({ value: m.id, label: m.name }))} value={form.municipalityId} onChange={set("municipalityId")} />
      <MarketPicker value={form.marketId} onChange={v => setForm({ ...form, marketId: v })} />
      <Text style={ui.label}>{t("sv.address")}</Text><TextInput style={ui.input} value={form.addressText} onChangeText={set("addressText")} />
      <PlaceFields directions={form.directions} point={form.point} onDirections={v => setForm({ ...form, directions: v })} onPoint={p => setForm({ ...form, point: p })} />
      <Text style={ui.label}>{t("sv.phone")}</Text><TextInput style={ui.input} keyboardType="phone-pad" value={form.phone} onChangeText={set("phone")} />
      <Text style={ui.label}>WhatsApp</Text><TextInput style={ui.input} keyboardType="phone-pad" value={form.whatsapp} onChangeText={set("whatsapp")} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={ui.label}>{t("sv.public_visible")}</Text><Switch value={form.active} onValueChange={v => setForm(f => ({ ...f, active: v }))} /></View>
      <Button title={editing ? t("common.save") : t("sv.biz_register")} disabled={busy} onPress={() => void submit()} />
      {editing && <Button title={t("common.cancel")} variant="secondary" onPress={() => { setEditing(null); setForm(empty); }} />}
    </View>
  </ScrollView>;
}
