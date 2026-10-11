import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { listMarketsForAdmin, saveMarket, setMarketStatus, friendlyError, MARKET_STATUS_LABELS, type MarketStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { useTerritory } from "./Directory";

const empty = { name: "", municipalityId: "", addressText: "", openingHours: "", photoUrl: "", description: "" };

/** Administração das praças: aprovar sugestões, editar dados e esconder. */
export function AdminMarkets() {
  const [items, setItems] = useState<any[]>([]); const [form, setForm] = useState(empty); const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const { municipalities } = useTerritory();
  async function load() { const r = await listMarketsForAdmin(supabase()); if (r.error) setError(friendlyError(r.error)); else setItems(r.data ?? []); }
  useEffect(() => { void load(); }, []);
  async function act(fn: () => PromiseLike<{ error: any }>, ok: string) {
    setError(""); setNotice("");
    const r = await fn();
    if (r.error) setError(friendlyError(r.error)); else { setNotice(ok); setForm(empty); setEditing(null); await load(); }
  }
  const field = (k: keyof typeof empty, label: string, multi = false) => <>
    <Text style={ui.label}>{label}</Text>
    <TextInput style={[ui.input, multi && ui.area]} multiline={multi} value={form[k]} onChangeText={v => setForm({ ...form, [k]: v })} />
  </>;
  return <View style={{ gap: 12 }}>
    <Message error={error} ok={notice} />
    <Text style={ui.h2}>Praças ({items.length})</Text>
    {items.map(m => <View key={m.id} style={ui.card}>
      <Text style={ui.label}>{m.name} · {MARKET_STATUS_LABELS[m.status as MarketStatus]}</Text>
      <Text style={ui.muted}>{[m.address_text, m.municipalities?.name, m.opening_hours].filter(Boolean).join(" · ") || "Sem morada nem horário"}</Text>
      {!!m.description && <Text style={ui.text}>{m.description}</Text>}
      {m.status !== "active" && <Button title={m.status === "pending" ? "Aprovar" : "Mostrar"} onPress={() => void act(() => setMarketStatus(supabase(), m.id, "active"), "Praça visível.")} />}
      {m.status !== "hidden" && <Button title="Esconder" variant="secondary" onPress={() => void act(() => setMarketStatus(supabase(), m.id, "hidden"), "Praça escondida.")} />}
      <Button title="Editar" variant="secondary" onPress={() => { setEditing(m.id); setForm({ name: m.name, municipalityId: m.municipality_id ?? "", addressText: m.address_text ?? "", openingHours: m.opening_hours ?? "", photoUrl: m.photo_url ?? "", description: m.description ?? "" }); }} />
    </View>)}
    <View style={ui.card}>
      <Text style={ui.h2}>{editing ? "Editar praça" : "Adicionar praça"}</Text>
      {field("name", "Nome")}
      <Text style={ui.label}>Município</Text>
      <Chips options={municipalities.map(m => ({ value: m.id, label: m.name }))} value={form.municipalityId} onChange={v => setForm({ ...form, municipalityId: v })} />
      {field("addressText", "Bairro / morada")}
      {field("openingHours", "Horário (ex.: Todos os dias, 06:00–18:00)")}
      {field("photoUrl", "Fotografia (endereço https://)")}
      {field("description", "Descrição", true)}
      <Button title={editing ? "Guardar" : "Adicionar"} onPress={() => { const status = items.find(i => i.id === editing)?.status ?? "active"; void act(() => saveMarket(supabase(), { ...form, status }, editing ?? undefined), editing ? "Praça atualizada." : "Praça adicionada."); }} />
      {!!editing && <Button title="Cancelar" variant="secondary" onPress={() => { setEditing(null); setForm(empty); }} />}
    </View>
  </View>;
}
