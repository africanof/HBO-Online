import { useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { checkAgentCode, isAgentCodeShape, listAgentsForAdmin, decideAgent, listAgentCommissionsForAdmin, decideAgentCommissions, sumCommissions,
  getPlatformSettings, formatPrice, friendlyErrorIn, agentCommissionLine, LANG_TAGS, AGENT_STATUS_LABELS, AGENT_COMMISSION_STATUS_LABELS, SELLER_COMMISSION_LABELS,
  type AgentCodeInfo, type AdminAgent, type AdminAgentCommission, type AgentStatus, type AgentCommissionStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { useT } from "../lib/i18n";

/** Campo «Código do agente» no formulário do anúncio, com confirmação do nome e da praça. */
export function AgentCodeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useT();
  const [info, setInfo] = useState<AgentCodeInfo | null>(null); const [checked, setChecked] = useState(false);
  useEffect(() => {
    setInfo(null); setChecked(false);
    if (!isAgentCodeShape(value)) return;
    const tm = setTimeout(() => { void checkAgentCode(supabase(), value).then(r => { setInfo(r); setChecked(true); }); }, 400);
    return () => clearTimeout(tm);
  }, [value]);
  return <View style={{ gap: 6 }}>
    <Text style={ui.label}>{t("sv.agf_label")}</Text>
    <TextInput accessibilityLabel={t("sv.agf_a11y")} value={value} onChangeText={onChange} placeholder={t("sv.agf_ph")} maxLength={12} autoCapitalize="characters" style={ui.input} />
    <Text accessibilityLiveRegion="polite" style={info ? ui.ok : ui.muted}>
      {info ? `✔ ${info.first_name}${info.market_name ? " — " + info.market_name : ""}` : checked ? t("sv.agf_not_found") :
        value.trim() && !isAgentCodeShape(value) ? t("sv.agf_shape") : t("sv.agf_hint")}
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
  const { t, tc, lang } = useT();
  const [agents, setAgents] = useState<AdminAgent[]>([]); const [items, setItems] = useState<AdminAgentCommission[]>([]);
  const [status, setStatus] = useState<AgentCommissionStatus | "all">("pending"); const [picked, setPicked] = useState<string[]>([]);
  const [pct, setPct] = useState("");
  const [note, setNote] = useState(""); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  async function load() {
    const [a, c] = await Promise.all([listAgentsForAdmin(supabase()), listAgentCommissionsForAdmin(supabase(), status === "all" ? "" : status)]);
    if (a.error || c.error) setError(friendlyErrorIn(a.error ?? c.error, lang));
    setAgents(a.data); setItems(c.data); setPicked([]);
  }
  useEffect(() => { void load(); }, [status]);
  useEffect(() => { void getPlatformSettings(supabase()).then(r => { const s = r.data; if (s) setPct(String(s.agent_sale_pct ?? "")); }); }, []);
  async function run(p: PromiseLike<{ error: any }>, msg: string) {
    setBusy(true); setError(""); setNotice("");
    const r = await p; setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(msg); setNote(""); await load(); }
  }
  function decide(a: AdminAgent, s: Exclude<AgentStatus, "pending">) {
    if (s === "active") { void run(decideAgent(supabase(), a.user_id, s), t("sv.aga_is_agent", { name: a.full_name, code: a.code })); return; }
    if (!note.trim()) { setError(t("sv.aga_need_reason")); return; }
    Alert.alert(s === "suspended" ? t("sv.aga_suspend") : t("sv.srv_decline"), `${a.full_name}: «${note.trim()}»`, [{ text: t("common.cancel"), style: "cancel" },
      { text: t("common.confirm"), style: "destructive", onPress: () => void run(decideAgent(supabase(), a.user_id, s, note), t("sv.done")) }]);
  }
  function saveRules() {
    const v = Number(pct.replace(",", "."));
    if (!pct.trim() || !(v >= 0 && v <= 20)) { setError(t("sv.aga_bad_pct")); return; }
    void run(supabase().from("platform_settings").update({ agent_sale_pct: v, updated_at: new Date().toISOString() }).eq("id", 1), t("sv.aga_rules_saved"));
  }
  const pend = items.filter(i => i.status === "pending");
  return <View style={{ gap: 12 }}>
    <Text style={ui.h2}>{t("sv.ag_title")}</Text>
    <Message error={error} ok={notice} />
    <View style={ui.card}>
      <Text style={ui.label}>{t("sv.aga_pct")}</Text>
      <TextInput accessibilityLabel={t("sv.aga_pct_a11y")} keyboardType="decimal-pad" value={pct} onChangeText={setPct} style={ui.input} />
      <Text style={ui.muted}>{t("sv.aga_pct_hint")}</Text>
      <Button title={t("sv.aga_save_rules")} disabled={busy} onPress={saveRules} />
    </View>
    <Text style={ui.label}>{t("sv.aga_reason")}</Text>
    <TextInput accessibilityLabel={t("sv.reason_plain")} value={note} onChangeText={setNote} maxLength={500} style={ui.input} />
    <Text style={ui.h2}>{t("sv.aga_agents", { n: agents.length })}</Text>
    {agents.length === 0 && <Text style={ui.text}>{t("sv.aga_none")}</Text>}
    {agents.map(a => <View key={a.user_id} style={ui.card}>
      <Text style={ui.label}>{a.full_name} · {a.code}</Text>
      <Text style={ui.text}>{tc(AGENT_STATUS_LABELS[a.status])}</Text>
      <Text style={ui.muted}>📍 {a.market_name ?? t("sv.aga_no_market")} · 📞 {a.phone}</Text>
      {!!a.note && <Text style={ui.text}>«{a.note}»</Text>}
      <Text style={ui.text}>{t("sv.aga_stats", { listings: a.listings, sold: a.sold, pending: a.pending_count, pendingKz: formatPrice(a.pending_kz), paid: formatPrice(a.approved_kz) })}</Text>
      {!!a.admin_note && <Text style={ui.muted}>{t("sv.note_x", { note: a.admin_note })}</Text>}
      {a.status !== "active" && <Button title={t("sv.approve")} disabled={busy} onPress={() => decide(a, "active")} />}
      {a.status === "pending" && <Button title={t("sv.decline")} variant="secondary" disabled={busy} onPress={() => decide(a, "rejected")} />}
      {a.status === "active" && <Button title={t("sv.suspend")} variant="danger" disabled={busy} onPress={() => decide(a, "suspended")} />}
    </View>)}
    <Text style={ui.h2}>{t("sv.commissions")}</Text>
    <Chips options={[{ value: "pending" as const, label: t("sv.f_pending") }, { value: "approved" as const, label: t("sv.f_approved") }, { value: "rejected" as const, label: t("sv.f_rejected") }, { value: "cancelled" as const, label: t("sv.f_cancelled") }, { value: "all" as const, label: t("sv.f_all") }]} value={status} onChange={setStatus} />
    {items.length === 0 && <Text style={ui.text}>{t("sv.nothing_here")}</Text>}
    {pend.length > 0 && <Check on={picked.length === pend.length} label={t("sv.aga_pick_all", { n: pend.length })} onPress={() => setPicked(picked.length === pend.length ? [] : pend.map(i => i.id))} />}
    {items.map(i => <View key={i.id} style={ui.card}>
      {i.status === "pending" ? <Check on={picked.includes(i.id)} label={`${i.listing_title} · ${tc(agentCommissionLine(i))}`} onPress={() => setPicked(p => p.includes(i.id) ? p.filter(x => x !== i.id) : [...p, i.id])} />
        : <Text style={ui.label}>{i.listing_title} · {tc(agentCommissionLine(i))}</Text>}
      <Text style={ui.text}>{t("sv.aga_line", { agent: i.agent_name, code: i.agent_code, owner: i.owner_name })}{i.seller_commission_status ? " · " + tc(SELLER_COMMISSION_LABELS[i.seller_commission_status] ?? i.seller_commission_status) : ""}</Text>
      <Text style={ui.muted}>{new Date(i.created_at).toLocaleString(LANG_TAGS[lang])} · {tc(AGENT_COMMISSION_STATUS_LABELS[i.status])}{i.admin_note ? " · " + i.admin_note : ""}</Text>
    </View>)}
    {picked.length > 0 && <View style={ui.card}>
      <Text style={ui.label}>{t("sv.aga_picked", { n: picked.length, v: formatPrice(sumCommissions(items, picked)) })}</Text>
      <Button title={t("sv.aga_confirm")} disabled={busy} onPress={() => void run(decideAgentCommissions(supabase(), picked, true), t("sv.aga_confirmed"))} />
      <Button title={t("sv.aga_decline")} variant="secondary" disabled={busy} onPress={() => void run(decideAgentCommissions(supabase(), picked, false, note), t("sv.aga_declined"))} />
    </View>}
  </View>;
}
