import { useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { checkAgentCode, isAgentCodeShape, listAgentsForAdmin, decideAgent, listAgentCommissionsForAdmin, decideAgentCommissions, sumCommissions,
  getPlatformSettings, formatPrice, friendlyError, agentCommissionLine, AGENT_STATUS_LABELS, AGENT_COMMISSION_STATUS_LABELS, SELLER_COMMISSION_LABELS,
  type AgentCodeInfo, type AdminAgent, type AdminAgentCommission, type AgentStatus, type AgentCommissionStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";

/** Campo «Código do agente» no formulário do anúncio, com confirmação do nome e da praça. */
export function AgentCodeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [info, setInfo] = useState<AgentCodeInfo | null>(null); const [checked, setChecked] = useState(false);
  useEffect(() => {
    setInfo(null); setChecked(false);
    if (!isAgentCodeShape(value)) return;
    const t = setTimeout(() => { void checkAgentCode(supabase(), value).then(r => { setInfo(r); setChecked(true); }); }, 400);
    return () => clearTimeout(t);
  }, [value]);
  return <View style={{ gap: 6 }}>
    <Text style={ui.label}>Código do agente que o ajudou (opcional)</Text>
    <TextInput accessibilityLabel="Código do agente" value={value} onChangeText={onChange} placeholder="Ex.: AG1001" maxLength={12} autoCapitalize="characters" style={ui.input} />
    <Text accessibilityLiveRegion="polite" style={info ? ui.ok : ui.muted}>
      {info ? `✔ ${info.first_name}${info.market_name ? " — " + info.market_name : ""}` : checked ? "Código não encontrado. Confirme com o agente." :
        value.trim() && !isAgentCodeShape(value) ? "O código começa por AG e tem números (ex.: AG1001)." : "Se um agente do Huambo Online o ajudou a pôr este anúncio, escreva o código dele."}
    </Text>
  </View>;
}

function Check({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onPress} style={{ flexDirection: "row", gap: 10, alignItems: "center", minHeight: 44 }}>
    <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: C.inputBorder, backgroundColor: on ? C.blue : C.card, alignItems: "center", justifyContent: "center" }}>{on && <Text style={{ color: C.onAccent, fontWeight: "900" }}>✓</Text>}</View>
    <Text style={[ui.text, { flex: 1 }]}>{label}</Text>
  </Pressable>;
}

/** Administração: pedidos de agentes, comissões e valores. */
export function AdminAgents() {
  const [agents, setAgents] = useState<AdminAgent[]>([]); const [items, setItems] = useState<AdminAgentCommission[]>([]);
  const [status, setStatus] = useState<AgentCommissionStatus | "all">("pending"); const [picked, setPicked] = useState<string[]>([]);
  const [pct, setPct] = useState("");
  const [note, setNote] = useState(""); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  async function load() {
    const [a, c] = await Promise.all([listAgentsForAdmin(supabase()), listAgentCommissionsForAdmin(supabase(), status === "all" ? "" : status)]);
    if (a.error || c.error) setError(friendlyError(a.error ?? c.error));
    setAgents(a.data); setItems(c.data); setPicked([]);
  }
  useEffect(() => { void load(); }, [status]);
  useEffect(() => { void getPlatformSettings(supabase()).then(r => { const s = r.data; if (s) setPct(String(s.agent_sale_pct ?? "")); }); }, []);
  async function run(p: PromiseLike<{ error: any }>, msg: string) {
    setBusy(true); setError(""); setNotice("");
    const r = await p; setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(msg); setNote(""); await load(); }
  }
  function decide(a: AdminAgent, s: Exclude<AgentStatus, "pending">) {
    if (s === "active") { void run(decideAgent(supabase(), a.user_id, s), `${a.full_name} é agente (${a.code}).`); return; }
    if (!note.trim()) { setError("Escreva o motivo no campo «Motivo» e carregue outra vez."); return; }
    Alert.alert(s === "suspended" ? "Suspender agente" : "Recusar pedido", `${a.full_name}: «${note.trim()}»`, [{ text: "Cancelar", style: "cancel" },
      { text: "Confirmar", style: "destructive", onPress: () => void run(decideAgent(supabase(), a.user_id, s, note), "Feito.") }]);
  }
  function saveRules() {
    const v = Number(pct.replace(",", "."));
    if (!pct.trim() || !(v >= 0 && v <= 20)) { setError("Escreva a percentagem do agente (de 0 a 20)."); return; }
    void run(supabase().from("platform_settings").update({ agent_sale_pct: v, updated_at: new Date().toISOString() }).eq("id", 1), "Regras dos agentes guardadas.");
  }
  const pend = items.filter(i => i.status === "pending");
  return <View style={{ gap: 12 }}>
    <Text style={ui.h2}>🤝 Agentes no terreno</Text>
    <Message error={error} ok={notice} />
    <View style={ui.card}>
      <Text style={ui.label}>Percentagem do agente em cada venda (%)</Text>
      <TextInput accessibilityLabel="Percentagem do agente (%)" keyboardType="decimal-pad" value={pct} onChangeText={setPct} style={ui.input} />
      <Text style={ui.muted}>Quando um anúncio feito com o código do agente é vendido, o agente ganha esta percentagem do valor da venda. Antes de confirmar, veja se o vendedor já pagou a comissão da venda.</Text>
      <Button title="Guardar regras" disabled={busy} onPress={saveRules} />
    </View>
    <Text style={ui.label}>Motivo (para recusar ou suspender)</Text>
    <TextInput accessibilityLabel="Motivo" value={note} onChangeText={setNote} maxLength={500} style={ui.input} />
    <Text style={ui.h2}>Agentes ({agents.length})</Text>
    {agents.length === 0 && <Text style={ui.text}>Ainda não há pedidos de agentes.</Text>}
    {agents.map(a => <View key={a.user_id} style={ui.card}>
      <Text style={ui.label}>{a.full_name} · {a.code}</Text>
      <Text style={ui.text}>{AGENT_STATUS_LABELS[a.status]}</Text>
      <Text style={ui.muted}>📍 {a.market_name ?? "Sem praça"} · 📞 {a.phone}</Text>
      {!!a.note && <Text style={ui.text}>«{a.note}»</Text>}
      <Text style={ui.text}>{a.listings} anúncios · {a.sold} vendidos · {a.pending_count} à espera ({formatPrice(a.pending_kz)}) · pago: {formatPrice(a.approved_kz)}</Text>
      {!!a.admin_note && <Text style={ui.muted}>Nota: {a.admin_note}</Text>}
      {a.status !== "active" && <Button title="✅ Aprovar" disabled={busy} onPress={() => decide(a, "active")} />}
      {a.status === "pending" && <Button title="Recusar" variant="secondary" disabled={busy} onPress={() => decide(a, "rejected")} />}
      {a.status === "active" && <Button title="⛔ Suspender" variant="danger" disabled={busy} onPress={() => decide(a, "suspended")} />}
    </View>)}
    <Text style={ui.h2}>Comissões</Text>
    <Chips options={[{ value: "pending" as const, label: "À espera" }, { value: "approved" as const, label: "Confirmadas" }, { value: "rejected" as const, label: "Recusadas" }, { value: "cancelled" as const, label: "Anuladas" }, { value: "all" as const, label: "Todas" }]} value={status} onChange={setStatus} />
    {items.length === 0 && <Text style={ui.text}>Nada aqui.</Text>}
    {pend.length > 0 && <Check on={picked.length === pend.length} label={`Escolher todas as que estão à espera (${pend.length})`} onPress={() => setPicked(picked.length === pend.length ? [] : pend.map(i => i.id))} />}
    {items.map(i => <View key={i.id} style={ui.card}>
      {i.status === "pending" ? <Check on={picked.includes(i.id)} label={`${i.listing_title} · ${agentCommissionLine(i)}`} onPress={() => setPicked(p => p.includes(i.id) ? p.filter(x => x !== i.id) : [...p, i.id])} />
        : <Text style={ui.label}>{i.listing_title} · {agentCommissionLine(i)}</Text>}
      <Text style={ui.text}>Agente {i.agent_name} ({i.agent_code}) · vendedor {i.owner_name}{i.seller_commission_status ? " · " + (SELLER_COMMISSION_LABELS[i.seller_commission_status] ?? i.seller_commission_status) : ""}</Text>
      <Text style={ui.muted}>{new Date(i.created_at).toLocaleString("pt-AO")} · {AGENT_COMMISSION_STATUS_LABELS[i.status]}{i.admin_note ? " · " + i.admin_note : ""}</Text>
    </View>)}
    {picked.length > 0 && <View style={ui.card}>
      <Text style={ui.label}>{picked.length} escolhida(s) · {formatPrice(sumCommissions(items, picked))}</Text>
      <Button title="✅ Confirmar e pôr no saldo" disabled={busy} onPress={() => void run(decideAgentCommissions(supabase(), picked, true), "Comissões confirmadas: o valor já está no saldo dos agentes.")} />
      <Button title="Recusar (usa o motivo acima)" variant="secondary" disabled={busy} onPress={() => void run(decideAgentCommissions(supabase(), picked, false, note), "Comissões recusadas.")} />
    </View>}
  </View>;
}
