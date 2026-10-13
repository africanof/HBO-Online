import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { Linking, ScrollView, Text, TextInput, View } from "react-native";
import { getMyAgentPanel, applyAsAgent, listMarketOptions, agentOfferText, agentInviteMessage, agentTotals, whatsappShareUrl, formatPrice, friendlyError,
  AGENT_STATUS_LABELS, AGENT_COMMISSION_STATUS_LABELS, type AgentPanel } from "@huambo-online/core";
import { supabase, currentUserId, siteUrl } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";

export default function Agente() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [p, setP] = useState<AgentPanel | null>(null); const [markets, setMarkets] = useState<{ id: string; name: string }[]>([]);
  const [marketId, setMarketId] = useState(""); const [fullName, setFullName] = useState(""); const [phone, setPhone] = useState(""); const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const r = await getMyAgentPanel(supabase());
    if (r.error) { setError(friendlyError(r.error)); return; }
    setP(r.data);
    const a = r.data?.agent;
    if (a) { setMarketId(a.market_id ?? ""); setFullName(a.full_name); setPhone(a.phone); setNote(a.note ?? ""); }
  }
  useFocusEffect(useCallback(() => {
    void currentUserId().then(id => { setUid(id); if (id) void load(); });
    void listMarketOptions(supabase()).then(r => setMarkets((r.data ?? []) as { id: string; name: string }[]));
  }, []));
  async function apply() {
    setBusy(true); setError(""); setNotice("");
    const r = await applyAsAgent(supabase(), { marketId, fullName, phone, note });
    setBusy(false);
    if (r.error) { setError(friendlyError(r.error)); return; }
    setEditing(false); setNotice(p?.agent?.status === "active" ? "Dados guardados." : "Pedido enviado. A administração vai responder em breve.");
    await load();
  }
  const intro = <>
    <Text style={ui.h1}>🤝 Agentes no terreno</Text>
    <Text style={ui.text}>Trabalha numa praça (por exemplo, o Kapango)? Ajude os vendedores a pôr os anúncios no Huambo Online e ganhe uma comissão por cada anúncio publicado.</Text>
    {!!p && <Text style={ui.ok}>{agentOfferText(p.fee_kz, p.daily_cap)}</Text>}
    <Text style={ui.text}>1. Peça para ser agente (escolha a sua praça). A administração confirma.</Text>
    <Text style={ui.text}>2. Recebe um código, por exemplo AG1001.</Text>
    <Text style={ui.text}>3. Ajude o vendedor a publicar na conta dele e peça-lhe para escrever o seu código.</Text>
    <Text style={ui.text}>4. Depois de a administração confirmar, o valor entra no seu saldo e pode levantar.</Text>
  </>;
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <ScrollView contentContainerStyle={ui.screen}>{intro}<Button title="Entrar para pedir" onPress={() => router.push("/login")} /></ScrollView>;
  const a = p?.agent, t = agentTotals(p);
  const form = <View style={ui.card}>
    <Text style={ui.h2}>{a ? "Os meus dados de agente" : "Pedir para ser agente"}</Text>
    <Text style={ui.label}>Praça onde trabalha</Text>
    {markets.length ? <Chips options={markets.map(m => ({ value: m.id, label: m.name }))} value={marketId} onChange={setMarketId} /> : <Text style={ui.muted}>A carregar as praças…</Text>}
    <Text style={ui.label}>Nome completo</Text>
    <TextInput accessibilityLabel="Nome completo" value={fullName} onChangeText={setFullName} maxLength={120} autoComplete="name" style={ui.input} />
    <Text style={ui.label}>Telefone</Text>
    <TextInput accessibilityLabel="Telefone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} placeholder="923 000 000" style={ui.input} />
    <Text style={ui.label}>Conte-nos um pouco (opcional)</Text>
    <TextInput accessibilityLabel="Nota" value={note} onChangeText={setNote} maxLength={500} multiline placeholder="Ex.: vendo na banca 12 e conheço muitos vendedores." style={[ui.input, ui.area]} />
    <Button title={busy ? "A enviar…" : a ? "Guardar" : "Enviar pedido"} disabled={busy} onPress={() => void apply()} />
    {!!a && <Button title="Cancelar" variant="secondary" onPress={() => setEditing(false)} />}
  </View>;
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>← A sua conta</Link>
    {intro}
    <Message error={error} ok={notice} />
    {!a && form}
    {!!a && <>
      <View style={ui.card}>
        <Text style={ui.label}>{AGENT_STATUS_LABELS[a.status]}</Text>
        <Text style={ui.text}>{a.full_name} · 📍 {a.market_name ?? "—"} · 📞 {a.phone}</Text>
        {a.status === "pending" && <Text style={ui.text}>Estamos a ver o seu pedido. Recebe um aviso quando for aprovado.</Text>}
        {(a.status === "rejected" || a.status === "suspended") && !!a.admin_note && <Text style={ui.error}>Motivo: {a.admin_note}</Text>}
        {a.status !== "suspended" && !editing && <Button title={a.status === "rejected" ? "Pedir outra vez" : "Mudar os meus dados"} variant="secondary" onPress={() => setEditing(true)} />}
      </View>
      {editing && form}
      {a.status === "active" && <>
        <View style={[ui.card, { alignItems: "center" }]}>
          <Text style={ui.text}>O seu código</Text>
          <Text style={{ ...ui.h1, fontSize: 40, letterSpacing: 2 }}>{a.code}</Text>
          <Text style={[ui.text, { textAlign: "center" }]}>Peça ao vendedor para o escrever em «Código do agente» quando publicar.</Text>
        </View>
        <Button title="📲 Convidar vendedores no WhatsApp" onPress={() => void Linking.openURL(whatsappShareUrl(agentInviteMessage(a.code, a.full_name.split(" ")[0], siteUrl)))} />
        <Button title="+ Publicar com um vendedor" variant="secondary" onPress={() => router.push(("/classificados/publicar?agente=" + a.code) as any)} />
        <View style={ui.card}>
          <Text style={ui.text}>📋 Anúncios com o seu código: {t.listings}</Text>
          <Text style={ui.text}>⏳ À espera de confirmação: {formatPrice(t.pending)}</Text>
          <Text style={ui.text}>✅ Já no saldo (total): {formatPrice(t.approved)}</Text>
        </View>
        <Button title="💰 Ver o meu saldo e levantar" variant="secondary" onPress={() => router.push("/conta/saldo" as any)} />
      </>}
      {(p?.commissions ?? []).length > 0 && <Text style={ui.h2}>Comissões</Text>}
      {(p?.commissions ?? []).map(c => <View key={c.id} style={ui.card}>
        <Text style={ui.label}>{c.listing_title} · {formatPrice(c.amount)}</Text>
        <Text style={ui.muted}>{new Date(c.created_at).toLocaleDateString("pt-AO")} · {AGENT_COMMISSION_STATUS_LABELS[c.status]}{c.admin_note ? " · " + c.admin_note : ""}</Text>
      </View>)}
    </>}
  </ScrollView>;
}
