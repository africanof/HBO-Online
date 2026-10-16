import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { listMarketsForAdmin, saveMarket, setMarketStatus, friendlyErrorIn, MARKET_STATUS_LABELS, type MarketStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT } from "../lib/i18n";
import { ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { useTerritory } from "./Directory";

const empty = { name: "", municipalityId: "", addressText: "", openingHours: "", photoUrl: "", description: "" };

/** Administração das praças: aprovar sugestões, editar dados e esconder. */
export function AdminMarkets() {
  const { lang, t, tc } = useT();
  const [items, setItems] = useState<any[]>([]); const [form, setForm] = useState(empty); const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const { municipalities } = useTerritory();
  async function load() { const r = await listMarketsForAdmin(supabase()); if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems(r.data ?? []); }
  useEffect(() => { void load(); }, []);
  async function act(fn: () => PromiseLike<{ error: any }>, ok: string) {
    setError(""); setNotice("");
    const r = await fn();
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(ok); setForm(empty); setEditing(null); await load(); }
  }
  const field = (k: keyof typeof empty, label: string, multi = false) => <>
    <Text style={ui.label}>{label}</Text>
    <TextInput style={[ui.input, multi && ui.area]} multiline={multi} value={form[k]} onChangeText={v => setForm({ ...form, [k]: v })} />
  </>;
  return <View style={{ gap: 12 }}>
    <Message error={error} ok={notice} />
    <Text style={ui.h2}>{t("ad.markets_count", { n: items.length })}</Text>
    {items.map(m => <View key={m.id} style={ui.card}>
      <Text style={ui.label}>{m.name} · {tc(MARKET_STATUS_LABELS[m.status as MarketStatus])}</Text>
      <Text style={ui.muted}>{[m.address_text, m.municipalities?.name, m.opening_hours].filter(Boolean).join(" · ") || t("ad.no_address")}</Text>
      {!!m.description && <Text style={ui.text}>{m.description}</Text>}
      {m.status !== "active" && <Button title={m.status === "pending" ? t("ad.approve") : t("ad.show")} onPress={() => void act(() => setMarketStatus(supabase(), m.id, "active"), t("ad.ok.market_visible"))} />}
      {m.status !== "hidden" && <Button title={t("ad.hide")} variant="secondary" onPress={() => void act(() => setMarketStatus(supabase(), m.id, "hidden"), t("ad.ok.market_hidden"))} />}
      <Button title={t("common.edit")} variant="secondary" onPress={() => { setEditing(m.id); setForm({ name: m.name, municipalityId: m.municipality_id ?? "", addressText: m.address_text ?? "", openingHours: m.opening_hours ?? "", photoUrl: m.photo_url ?? "", description: m.description ?? "" }); }} />
    </View>)}
    <View style={ui.card}>
      <Text style={ui.h2}>{editing ? t("ad.edit_market") : t("ad.add_market")}</Text>
      {field("name", t("ad.f.name"))}
      <Text style={ui.label}>{t("ad.f.municipality")}</Text>
      <Chips options={municipalities.map(m => ({ value: m.id, label: m.name }))} value={form.municipalityId} onChange={v => setForm({ ...form, municipalityId: v })} />
      {field("addressText", t("ad.f.address"))}
      {field("openingHours", t("ad.f.hours"))}
      {field("photoUrl", t("ad.f.photo"))}
      {field("description", t("ad.f.description"), true)}
      <Button title={editing ? t("common.save") : t("ad.add")} onPress={() => { const status = items.find(i => i.id === editing)?.status ?? "active"; void act(() => saveMarket(supabase(), { ...form, status }, editing ?? undefined), editing ? t("ad.ok.market_updated") : t("ad.ok.market_added")); }} />
      {!!editing && <Button title={t("common.cancel")} variant="secondary" onPress={() => { setEditing(null); setForm(empty); }} />}
    </View>
  </View>;
}
