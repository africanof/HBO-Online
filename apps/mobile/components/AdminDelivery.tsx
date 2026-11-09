import { useEffect, useState } from "react";
import { Switch, Text, TextInput, View } from "react-native";
import { listDeliveryFees, saveDeliveryFee, listPickupPointsAdmin, savePickupPoint, friendlyErrorIn, parsePrice, formatPrice, type DeliveryFeeRow, type PickupPointAdmin } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Chips, Message, SmallButton } from "./Ui";
import { PointPicker } from "./Place";
import { useT } from "../lib/i18n";

type Muni = { id: string; name: string };
const EMPTY: Omit<PickupPointAdmin, "id"> & { id?: string | null } = { id: null, name: "", address: "", directions: null, municipality_id: "", geo_lat: null, geo_lng: null, hours: null, phone: null, active: true };

/** Equipa: preços de entrega por município e pontos de recolha. */
export function AdminDelivery() {
  const { t, lang } = useT();
  const [munis, setMunis] = useState<Muni[]>([]); const [fees, setFees] = useState<Record<string, DeliveryFeeRow>>({});
  const [points, setPoints] = useState<PickupPointAdmin[]>([]); const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [error, setError] = useState(""); const [ok, setOk] = useState("");
  async function load() {
    const c = supabase();
    const m = await c.from("municipalities").select("id,name,provinces!inner(name)").eq("provinces.name", "Huambo").order("name");
    setMunis(((m.data ?? []) as any[]).map(x => ({ id: x.id, name: x.name })));
    const f = await listDeliveryFees(c); setFees(Object.fromEntries(f.data.map(x => [x.municipality_id, x])));
    const p = await listPickupPointsAdmin(c); setPoints(p.data);
  }
  useEffect(() => { void load(); }, []);
  const row = (id: string): DeliveryFeeRow => fees[id] ?? { municipality_id: id, home_fee: null, point_fee: null, eta_text: "1 a 2 dias úteis", active: true };
  const setRow = (id: string, patch: Partial<DeliveryFeeRow>) => setFees(f => ({ ...f, [id]: { ...row(id), ...patch } }));
  const num = (v: string) => v.trim() === "" ? null : parsePrice(v) ?? null;
  async function saveFee(id: string) { setError(""); setOk(""); const r = await saveDeliveryFee(supabase(), row(id)); if (r.error) setError(friendlyErrorIn(r.error, lang)); else setOk(t("dl.saved")); }
  async function savePoint() { if (!form) return; setError(""); setOk(""); const r = await savePickupPoint(supabase(), form); if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setOk(t("dl.saved")); setForm(null); await load(); } }
  return <View style={{ gap: 12 }}>
    <Message error={error} ok={ok} />
    <Text style={ui.h2}>{t("dl.fees_title")}</Text>
    <Text style={ui.muted}>{t("dl.fees_help")}</Text>
    {munis.map(m => { const r = row(m.id); return <View key={m.id} style={[ui.card, { gap: 6 }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={ui.label}>{m.name}</Text><Switch value={r.active} onValueChange={v => setRow(m.id, { active: v })} accessibilityLabel={t("dl.active")} /></View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><Text style={ui.muted}>{t("dl.home_fee")}</Text><TextInput style={ui.input} keyboardType="numeric" value={r.home_fee == null ? "" : String(r.home_fee)} onChangeText={v => setRow(m.id, { home_fee: num(v) })} /></View>
        <View style={{ flex: 1 }}><Text style={ui.muted}>{t("dl.point_fee")}</Text><TextInput style={ui.input} keyboardType="numeric" value={r.point_fee == null ? "" : String(r.point_fee)} onChangeText={v => setRow(m.id, { point_fee: num(v) })} /></View>
      </View>
      <Text style={ui.muted}>{t("dl.eta")}</Text><TextInput style={ui.input} value={r.eta_text} onChangeText={v => setRow(m.id, { eta_text: v })} />
      <SmallButton title={t("dl.save")} onPress={() => void saveFee(m.id)} />
    </View>; })}

    <Text style={ui.h2}>{t("dl.points_title")}</Text>
    <Text style={ui.muted}>{t("dl.points_help")}</Text>
    {!form && <Button title={t("dl.new_point")} onPress={() => setForm({ ...EMPTY, municipality_id: munis.find(m => m.name === "Huambo")?.id ?? "" })} />}
    {!!form && <View style={[ui.card, { gap: 6 }]}>
      <Text style={ui.label}>{t("dl.name")}</Text><TextInput style={ui.input} value={form.name} onChangeText={v => setForm({ ...form, name: v })} />
      <Text style={ui.label}>{t("dl.address")}</Text><TextInput style={ui.input} value={form.address} onChangeText={v => setForm({ ...form, address: v })} />
      <Text style={ui.label}>{t("dl.directions")}</Text><TextInput style={ui.input} value={form.directions ?? ""} onChangeText={v => setForm({ ...form, directions: v || null })} />
      <Text style={ui.label}>{t("co.area")}</Text>
      <Chips options={munis.map(m => ({ value: m.id, label: m.name }))} value={form.municipality_id} onChange={v => setForm({ ...form, municipality_id: v })} />
      <Text style={ui.label}>{t("dl.hours")}</Text><TextInput style={ui.input} value={form.hours ?? ""} onChangeText={v => setForm({ ...form, hours: v || null })} />
      <Text style={ui.label}>{t("dl.phone")}</Text><TextInput style={ui.input} keyboardType="phone-pad" value={form.phone ?? ""} onChangeText={v => setForm({ ...form, phone: v || null })} />
      <PointPicker point={form.geo_lat != null && form.geo_lng != null ? { lat: Number(form.geo_lat), lng: Number(form.geo_lng) } : null} onChange={p => setForm({ ...form, geo_lat: p?.lat ?? null, geo_lng: p?.lng ?? null })} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={ui.label}>{t("dl.active")}</Text><Switch value={form.active} onValueChange={v => setForm({ ...form, active: v })} /></View>
      <Button title={t("dl.save")} onPress={() => void savePoint()} />
      <Button title={t("common.cancel")} variant="secondary" onPress={() => setForm(null)} />
    </View>}
    {points.length === 0 && <Text style={ui.text}>{t("dl.none")}</Text>}
    {points.map(p => <View key={p.id} style={ui.card}>
      <Text style={ui.label}>📦 {p.name}{p.active ? "" : " · " + t("dl.off")}</Text>
      <Text style={ui.muted}>📍 {p.address} · {munis.find(m => m.id === p.municipality_id)?.name ?? ""}{p.hours ? " · 🕘 " + p.hours : ""}</Text>
      <Text style={ui.muted}>{t("dl.point_fee")}: {row(p.municipality_id).point_fee != null ? formatPrice(row(p.municipality_id).point_fee) : "—"}</Text>
      <SmallButton title={t("dl.edit")} onPress={() => setForm({ ...p })} />
    </View>)}
  </View>;
}
