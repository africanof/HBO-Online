import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "expo-router";
import { Alert, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { listMyBusinesses, saveBusiness, deleteBusiness, listDirectoryCategories, friendlyError } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { ui } from "../../lib/ui";
import { Button, Chips, Message } from "../../components/Ui";
import { useTerritory } from "../../components/Directory";

type Option = { id: string; name: string };
const empty = { name: "", description: "", categoryId: "", municipalityId: "", phone: "", whatsapp: "", addressText: "", active: true };

export default function MinhasEmpresas() {
  const router = useRouter();
  const scroll = useRef<ScrollView>(null);
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<any[]>([]); const [form, setForm] = useState(empty); const [editing, setEditing] = useState<string | null>(null);
  const [categories, setCategories] = useState<Option[]>([]); const { provinces, municipalities, provinceId, setProvinceId } = useTerritory();
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);

  async function load(id: string) { const r = await listMyBusinesses(supabase(), id); setItems(r.data ?? []); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(id); }); void listDirectoryCategories(supabase(), "businesses").then(({ data }) => setCategories(data ?? [])); }, []);
  const set = (k: keyof typeof empty) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  async function submit() {
    if (!uid) return;
    setBusy(true); setError(""); setNotice("");
    const r = await saveBusiness(supabase(), uid, form, editing ?? undefined); setBusy(false);
    if (r.error) { setError(friendlyError(r.error)); return; }
    setNotice(editing ? "Empresa atualizada." : "Empresa registada."); setForm(empty); setEditing(null); await load(uid);
  }

  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <View style={ui.screen}><Link href="/empresas" style={ui.link}>← Empresas</Link><Text style={ui.h1}>As minhas empresas</Text><Text style={ui.text}>Inicie sessão para registar a sua empresa.</Text><Button title="Entrar" onPress={() => router.push("/login")} /></View>;

  return <ScrollView ref={scroll} contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>← Conta</Link>
    <Text style={ui.h1}>As minhas empresas</Text>
    <Message error={error} ok={notice} />
    {items.map(b => <View key={b.id} style={ui.card}>
      <Text style={ui.h2}>{b.name}{b.verified ? " ✔️" : ""}{b.active ? "" : " (oculta)"}</Text>
      <Button title="Ver" variant="secondary" onPress={() => router.push(("/empresas/" + b.id) as any)} />
      <Button title="Editar" variant="secondary" onPress={() => { setEditing(b.id); setForm({ name: b.name ?? "", description: b.description ?? "", categoryId: b.category_id ?? "", municipalityId: b.municipality_id ?? "", phone: b.phone ?? "", whatsapp: b.whatsapp ?? "", addressText: b.address_text ?? "", active: b.active }); scroll.current?.scrollToEnd(); }} />
      <Button title="Apagar" variant="danger" onPress={() => Alert.alert("Apagar empresa", "Tem a certeza?", [{ text: "Cancelar", style: "cancel" }, { text: "Apagar", style: "destructive", onPress: async () => { const r = await deleteBusiness(supabase(), b.id); if (r.error) setError(friendlyError(r.error)); else await load(uid); } }])} />
    </View>)}
    <View style={ui.card}>
      <Text style={ui.h2}>{editing ? "Editar empresa" : "Registar empresa"}</Text>
      <Text style={ui.label}>Nome</Text><TextInput style={ui.input} value={form.name} onChangeText={set("name")} />
      <Text style={ui.label}>Descrição</Text><TextInput style={[ui.input, ui.area]} multiline value={form.description} onChangeText={set("description")} />
      <Text style={ui.label}>Categoria</Text><Chips options={categories.map(c => ({ value: c.id, label: c.name }))} value={form.categoryId} onChange={set("categoryId")} />
      <Text style={ui.label}>Província</Text><Chips options={provinces.map(p => ({ value: p.id, label: p.name }))} value={provinceId} onChange={v => { setProvinceId(v); set("municipalityId")(""); }} />
      <Text style={ui.label}>Município</Text><Chips options={municipalities.map(m => ({ value: m.id, label: m.name }))} value={form.municipalityId} onChange={set("municipalityId")} />
      <Text style={ui.label}>Morada / referência</Text><TextInput style={ui.input} value={form.addressText} onChangeText={set("addressText")} />
      <Text style={ui.label}>Telefone</Text><TextInput style={ui.input} keyboardType="phone-pad" value={form.phone} onChangeText={set("phone")} />
      <Text style={ui.label}>WhatsApp</Text><TextInput style={ui.input} keyboardType="phone-pad" value={form.whatsapp} onChangeText={set("whatsapp")} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={ui.label}>Visível ao público</Text><Switch value={form.active} onValueChange={v => setForm(f => ({ ...f, active: v }))} /></View>
      <Button title={editing ? "Guardar" : "Registar empresa"} disabled={busy} onPress={() => void submit()} />
      {editing && <Button title="Cancelar" variant="secondary" onPress={() => { setEditing(null); setForm(empty); }} />}
    </View>
  </ScrollView>;
}
