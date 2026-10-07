import { useEffect, useState } from "react";
import { Link, useRouter } from "expo-router";
import { Alert, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { getProvider, saveMyProviderProfile, listProviderServices, saveService, deleteService, listDirectoryCategories, friendlyError, parsePrice, formatPrice } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { ui } from "../../lib/ui";
import { Button, Chips, Message } from "../../components/Ui";
import { useTerritory } from "../../components/Directory";

type Option = { id: string; name: string };
const empty = { displayName: "", headline: "", bio: "", categoryId: "", municipalityId: "", phone: "", whatsapp: "", active: true };

export default function PerfilProfissional() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [form, setForm] = useState(empty); const [exists, setExists] = useState(false);
  const [services, setServices] = useState<any[]>([]); const [svc, setSvc] = useState({ title: "", description: "", price: "" });
  const [categories, setCategories] = useState<Option[]>([]); const { provinces, municipalities, provinceId, setProvinceId } = useTerritory();
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);

  async function load(id: string) {
    const c = supabase();
    const p = await getProvider(c, id);
    if (p.data) { setExists(true); setForm({ displayName: p.data.display_name ?? "", headline: p.data.headline ?? "", bio: p.data.bio ?? "", categoryId: p.data.category_id ?? "", municipalityId: p.data.municipality_id ?? "", phone: p.data.phone ?? "", whatsapp: p.data.whatsapp ?? "", active: p.data.active }); }
    const s = await listProviderServices(c, id, true); setServices(s.data ?? []);
  }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(id); }); void listDirectoryCategories(supabase(), "providers").then(({ data }) => setCategories(data ?? [])); }, []);
  const set = (k: keyof typeof empty) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  async function run(fn: () => PromiseLike<{ error: any }>, ok: string) {
    setBusy(true); setError(""); setNotice("");
    const r = await fn(); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(ok); if (uid) await load(uid); }
    return !r.error;
  }

  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <View style={ui.screen}><Link href="/profissionais" style={ui.link}>← Profissionais</Link><Text style={ui.h1}>Perfil profissional</Text><Text style={ui.text}>Inicie sessão para criar o seu perfil.</Text><Button title="Entrar" onPress={() => router.push("/login")} /></View>;

  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>← Conta</Link>
    <Text style={ui.h1}>{exists ? "O meu perfil profissional" : "Criar perfil profissional"}</Text>
    <Text style={ui.text}>Apareça na lista de profissionais e receba pedidos de clientes.</Text>
    {exists && <Button title="Ver o meu perfil público" variant="secondary" onPress={() => router.push(("/profissionais/" + uid) as any)} />}
    <Message error={error} ok={notice} />
    <View style={ui.card}>
      <Text style={ui.label}>Nome profissional</Text><TextInput style={ui.input} value={form.displayName} onChangeText={set("displayName")} placeholder="Ex.: João Eletricista" />
      <Text style={ui.label}>Resumo</Text><TextInput style={ui.input} value={form.headline} onChangeText={set("headline")} placeholder="Ex.: Instalações elétricas" />
      <Text style={ui.label}>Sobre si</Text><TextInput style={[ui.input, ui.area]} multiline value={form.bio} onChangeText={set("bio")} />
      <Text style={ui.label}>Área de atividade</Text><Chips options={categories.map(c => ({ value: c.id, label: c.name }))} value={form.categoryId} onChange={set("categoryId")} />
      <Text style={ui.label}>Província</Text><Chips options={provinces.map(p => ({ value: p.id, label: p.name }))} value={provinceId} onChange={v => { setProvinceId(v); set("municipalityId")(""); }} />
      <Text style={ui.label}>Município</Text><Chips options={municipalities.map(m => ({ value: m.id, label: m.name }))} value={form.municipalityId} onChange={set("municipalityId")} />
      <Text style={ui.label}>Telefone</Text><TextInput style={ui.input} keyboardType="phone-pad" value={form.phone} onChangeText={set("phone")} />
      <Text style={ui.label}>WhatsApp</Text><TextInput style={ui.input} keyboardType="phone-pad" value={form.whatsapp} onChangeText={set("whatsapp")} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={ui.label}>Perfil visível ao público</Text><Switch value={form.active} onValueChange={v => setForm(f => ({ ...f, active: v }))} /></View>
      <Button title={exists ? "Guardar perfil" : "Criar perfil"} disabled={busy} onPress={() => void run(() => saveMyProviderProfile(supabase(), uid, form), "Perfil guardado.")} />
    </View>
    {exists && <View style={{ gap: 10 }}>
      <Text style={ui.h2}>Os meus serviços</Text>
      <View style={ui.card}>
        <Text style={ui.label}>Serviço</Text><TextInput style={ui.input} value={svc.title} onChangeText={v => setSvc({ ...svc, title: v })} />
        <Text style={ui.label}>Descrição</Text><TextInput style={ui.input} value={svc.description} onChangeText={v => setSvc({ ...svc, description: v })} />
        <Text style={ui.label}>Preço desde (Kz)</Text><TextInput style={ui.input} keyboardType="decimal-pad" value={svc.price} onChangeText={v => setSvc({ ...svc, price: v })} placeholder="Vazio = sob consulta" />
        <Button title="Adicionar serviço" disabled={busy} onPress={() => void run(() => saveService(supabase(), uid, { title: svc.title, description: svc.description, priceFrom: parsePrice(svc.price), categoryId: form.categoryId }), "Serviço adicionado.").then(ok => { if (ok) setSvc({ title: "", description: "", price: "" }); })} />
      </View>
      {services.map(s => <View key={s.id} style={ui.card}>
        <Text style={ui.label}>{s.title}</Text>
        <Text style={ui.text}>{s.price_from != null ? "desde " + formatPrice(s.price_from, s.currency) : "sob consulta"}</Text>
        <Button title="Apagar" variant="danger" onPress={() => Alert.alert("Apagar serviço", "Tem a certeza?", [{ text: "Cancelar", style: "cancel" }, { text: "Apagar", style: "destructive", onPress: () => void run(() => deleteService(supabase(), s.id), "Serviço apagado.") }])} />
      </View>)}
    </View>}
  </ScrollView>;
}
