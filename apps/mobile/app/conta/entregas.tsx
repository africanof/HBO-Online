import { useEffect, useState } from "react";
import { Link, useRouter } from "expo-router";
import { Alert, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { getDeliveryPolicy, saveDeliverySettings, clearDeliverySettings, validateDeliverySettings, deliveryPolicyLines, parsePrice, formatPrice,
  friendlyErrorIn, type DeliveryPolicy, type DeliverySettingsInput } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { ui, C } from "../../lib/ui";
import { Button, Message } from "../../components/Ui";
import { useTerritory } from "../../components/Directory";
import { MunicipalityChooser } from "../../components/Delivery";
import { useT } from "../../lib/i18n";

/**
 * 🚚 Regras de entrega do vendedor: levantamento no local e/ou entrega, preço por município (e para os outros),
 * entrega grátis a partir de um valor, valor mínimo para entregar, prazo e nota. O carrinho usa estas regras.
 */
type Zone = { municipalityId: string; name: string; fee: string };
type Form = { pickupEnabled: boolean; pickupPlace: string; deliveryEnabled: boolean; defaultFee: string; freeOver: string; minOrder: string; days: string; note: string; zones: Zone[] };
const EMPTY: Form = { pickupEnabled: true, pickupPlace: "", deliveryEnabled: false, defaultFee: "", freeOver: "", minOrder: "", days: "", note: "", zones: [] };
const money = (v: number | null | undefined) => v == null ? "" : String(v);

function fromPolicy(p: DeliveryPolicy): Form {
  return { pickupEnabled: p.pickup_enabled, pickupPlace: p.pickup_place ?? "", deliveryEnabled: p.delivery_enabled, defaultFee: money(p.default_fee),
    freeOver: money(p.free_over), minOrder: money(p.min_order), days: p.delivery_days ?? "", note: p.note ?? "",
    zones: p.zones.map(z => ({ municipalityId: z.municipality_id, name: z.municipality_name ?? "", fee: String(z.fee) })) };
}
/** Número do formulário: vazio = null; mal escrito = NaN (a validação do core apanha). */
const amount = (s: string): number | null => { const n = parsePrice(s); return n === undefined ? null : n; };
function toInput(f: Form): DeliverySettingsInput {
  return { pickupEnabled: f.pickupEnabled, pickupPlace: f.pickupPlace, deliveryEnabled: f.deliveryEnabled, defaultFee: amount(f.defaultFee),
    freeOver: amount(f.freeOver), minOrder: amount(f.minOrder), deliveryDays: f.days, note: f.note,
    zones: f.zones.map(z => ({ municipalityId: z.municipalityId, fee: amount(z.fee) ?? NaN })) };
}
/** Pré-visualização: as mesmas linhas que os clientes vão ver (só com os números que já estão bem escritos). */
function previewPolicy(f: Form): DeliveryPolicy {
  const ok = (s: string) => { const n = amount(s); return n != null && Number.isFinite(n) && n >= 0 ? n : null; };
  return { pickup_enabled: f.pickupEnabled, pickup_place: f.pickupPlace.trim() || null, delivery_enabled: f.deliveryEnabled, default_fee: ok(f.defaultFee),
    free_over: ok(f.freeOver), min_order: ok(f.minOrder), delivery_days: f.days.trim() || null, note: f.note.trim() || null,
    zones: f.zones.filter(z => ok(z.fee) != null).map(z => ({ municipality_id: z.municipalityId, municipality_name: z.name, fee: ok(z.fee)! })) };
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 52 }}>
    <Text style={[ui.label, { flex: 1, fontSize: 18 }]}>{label}</Text>
    <Switch accessibilityLabel={label} value={value} onValueChange={onChange} style={{ transform: [{ scale: 1.2 }] }} />
  </View>;
}

export default function Entregas() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [form, setForm] = useState<Form>(EMPTY); const [configured, setConfigured] = useState(false); const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const { provinces, municipalities, provinceId, setProvinceId } = useTerritory();
  const [newZone, setNewZone] = useState<{ id: string; name: string }>({ id: "", name: "" }); const [newFee, setNewFee] = useState("");
  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => { setNotice(""); setForm(f => ({ ...f, [k]: v })); };

  async function load(id: string) {
    const r = await getDeliveryPolicy(supabase(), id);
    if (r.error) setError(friendlyErrorIn(r.error, lang));
    else { setConfigured(!!r.data); setForm(r.data ? fromPolicy(r.data) : EMPTY); }
    setLoaded(true);
  }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(id); }); }, []);

  function addZone() {
    setError("");
    const fee = amount(newFee);
    if (!newZone.id) { setError(t("sh.dl.pick_municipality")); return; }
    if (fee == null || !Number.isFinite(fee) || fee < 0) { setError(t("sh.dl.bad_fee")); return; }
    set("zones")([...form.zones, { municipalityId: newZone.id, name: newZone.name, fee: String(fee) }]);
    setNewZone({ id: "", name: "" }); setNewFee("");
  }
  async function save() {
    if (!uid || busy) return;
    setError(""); setNotice("");
    const input = toInput(form);
    const bad = validateDeliverySettings(input);
    if (bad) { setError(tc(bad)); return; }
    setBusy(true);
    const r = await saveDeliverySettings(supabase(), uid, input); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("sh.dl.saved")); await load(uid); }
  }
  function clear() {
    if (!uid) return;
    Alert.alert(t("sh.dl.clear_q"), t("sh.dl.clear_text"), [{ text: t("common.cancel"), style: "cancel" }, { text: t("sh.dl.clear"), style: "destructive", onPress: async () => {
      setBusy(true); setError(""); setNotice("");
      const r = await clearDeliverySettings(supabase(), uid); setBusy(false);
      if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("sh.dl.cleared")); await load(uid); }
    } }]);
  }

  if (uid === undefined || (uid && !loaded)) return <View style={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></View>;
  if (!uid) return <View style={ui.screen}><Text style={ui.h1}>{t("sh.dl.title")}</Text><Button title={t("auth.login")} onPress={() => router.push("/login")} /></View>;

  const preview = deliveryPolicyLines(previewPolicy(form));
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>{"← " + t("nav.account_short")}</Link>
    <Text style={ui.h1}>{t("sh.dl.title")}</Text>
    <Text style={ui.text}>{t("sh.dl.intro")}</Text>
    {!configured && <Text style={[ui.muted, { backgroundColor: C.surface, padding: 10, borderRadius: 10 }]}>{t("sh.dl.not_configured")}</Text>}

    <View style={ui.card}>
      <Toggle label={t("sh.dl.pickup")} value={form.pickupEnabled} onChange={set("pickupEnabled")} />
      {form.pickupEnabled && <><Text style={ui.label}>{t("sh.dl.pickup_place")}</Text>
        <TextInput style={ui.input} value={form.pickupPlace} onChangeText={set("pickupPlace")} placeholder={t("sh.dl.pickup_place_ph")} placeholderTextColor={C.muted} maxLength={300} accessibilityLabel={t("sh.dl.pickup_place")} /></>}
    </View>

    <View style={ui.card}>
      <Toggle label={t("sh.dl.delivery")} value={form.deliveryEnabled} onChange={set("deliveryEnabled")} />
      {form.deliveryEnabled && <>
        <Text style={ui.h2}>{t("sh.dl.zones")}</Text>
        <Text style={ui.muted}>{t("sh.dl.zones_hint")}</Text>
        {form.zones.length === 0 && <Text style={ui.muted}>{t("sh.dl.no_zones")}</Text>}
        {form.zones.map((z, i) => <View key={z.municipalityId} style={{ gap: 6, borderTopWidth: 1, borderColor: C.line, paddingTop: 8 }}>
          <Text style={ui.label}>📍 {z.name || t("auth.municipality")}</Text>
          <View style={[ui.row, { alignItems: "center" }]}>
            <TextInput style={[ui.input, { flexGrow: 1, flexBasis: 120 }]} keyboardType="decimal-pad" value={z.fee} accessibilityLabel={t("sh.dl.fee_for", { place: z.name })}
              onChangeText={v => set("zones")(form.zones.map((x, j) => j === i ? { ...x, fee: v } : x))} />
            <Button title={t("sh.remove")} variant="danger" onPress={() => set("zones")(form.zones.filter((_, j) => j !== i))} />
          </View>
        </View>)}
        <View style={[ui.card, { backgroundColor: C.surface }]}>
          <Text style={ui.label}>{t("sh.dl.add_zone")}</Text>
          <MunicipalityChooser provinces={provinces} municipalities={municipalities} provinceId={provinceId} setProvinceId={setProvinceId}
            value={newZone.id} onChange={(id, name) => setNewZone({ id, name })} exclude={form.zones.map(z => z.municipalityId)} />
          <Text style={ui.label}>{t("sh.dl.fee_kz")}</Text>
          <TextInput style={ui.input} keyboardType="decimal-pad" value={newFee} onChangeText={setNewFee} placeholder="1500" placeholderTextColor={C.muted} accessibilityLabel={t("sh.dl.fee_kz")} />
          <Button title={t("sh.dl.add_zone_btn")} variant="secondary" disabled={!newZone.id} onPress={addZone} />
        </View>

        <Text style={ui.label}>{t("sh.dl.default_fee")}</Text>
        <TextInput style={ui.input} keyboardType="decimal-pad" value={form.defaultFee} onChangeText={set("defaultFee")} accessibilityLabel={t("sh.dl.default_fee")} />
        <Text style={ui.muted}>{t("sh.dl.default_fee_hint")}</Text>
        <Text style={ui.label}>{t("sh.dl.free_over")}</Text>
        <TextInput style={ui.input} keyboardType="decimal-pad" value={form.freeOver} onChangeText={set("freeOver")} accessibilityLabel={t("sh.dl.free_over")} />
        <Text style={ui.muted}>{t("sh.dl.free_over_hint")}</Text>
        <Text style={ui.label}>{t("sh.dl.min_order")}</Text>
        <TextInput style={ui.input} keyboardType="decimal-pad" value={form.minOrder} onChangeText={set("minOrder")} accessibilityLabel={t("sh.dl.min_order")} />
        <Text style={ui.muted}>{t("sh.dl.min_order_hint")}</Text>
        <Text style={ui.label}>{t("sh.dl.days")}</Text>
        <TextInput style={ui.input} value={form.days} onChangeText={set("days")} placeholder={t("sh.dl.days_ph")} placeholderTextColor={C.muted} maxLength={120} accessibilityLabel={t("sh.dl.days")} />
      </>}
      <Text style={ui.label}>{t("sh.dl.note")}</Text>
      <TextInput style={[ui.input, ui.area]} multiline value={form.note} onChangeText={set("note")} placeholder={t("sh.dl.note_ph")} placeholderTextColor={C.muted} maxLength={300} accessibilityLabel={t("sh.dl.note")} />
    </View>

    <View style={[ui.card, { borderColor: C.blue, borderWidth: 2 }]}>
      <Text style={ui.h2}>{t("sh.dl.preview")}</Text>
      <Text style={ui.muted}>{t("sh.dl.preview_hint")}</Text>
      {preview.map((line, i) => <Text key={i} style={ui.text}>{tc(line)}</Text>)}
      {form.deliveryEnabled && form.zones.length > 0 && <Text style={ui.muted}>{form.zones.map(z => `${z.name}: ${Number.isFinite(amount(z.fee) ?? NaN) ? formatPrice(amount(z.fee)!) : "?"}`).join(" · ")}</Text>}
    </View>

    <Message error={error} ok={notice} />
    <Button title={busy ? t("sh.saving") : t("sh.dl.save")} disabled={busy} onPress={() => void save()} />
    {configured && <Button title={t("sh.dl.clear")} variant="secondary" disabled={busy} onPress={clear} />}
    <Button title={t("account.products")} variant="secondary" onPress={() => router.push("/conta/produtos" as any)} />
  </ScrollView>;
}
