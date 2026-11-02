import { useEffect, useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";
import { adminListProvinces, setProvinceActive, adminListMunicipalities, addMunicipalities, renameMunicipality, deleteMunicipality,
  friendlyErrorIn, type AdminProvince } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT } from "../lib/i18n";
import { C, ui } from "../lib/ui";
import { Button, Message } from "./Ui";

type Run = (fn: () => PromiseLike<{ data?: any; error: any }>, message: string | ((r: { data?: any }) => string)) => Promise<boolean>;

/** Painel: desbloquear as províncias e gerir os municípios de cada uma. */
export function AdminProvinces() {
  const { lang, t } = useT();
  const [list, setList] = useState<AdminProvince[]>([]); const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);
  async function load() { const r = await adminListProvinces(supabase()); if (r.error) setErr(friendlyErrorIn(r.error, lang)); else setList(r.data); }
  useEffect(() => { void load(); }, []);
  const run: Run = async (fn, message) => {
    setBusy(true); setErr(""); setOk("");
    const r = await fn(); setBusy(false);
    if (r.error) { setErr(friendlyErrorIn(r.error, lang)); return false; }
    setOk(typeof message === "function" ? message(r) : message); await load(); return true;
  };
  const ask = (title: string, q: string, onYes: () => void) => Alert.alert(title, q, [{ text: t("common.cancel"), style: "cancel" }, { text: title, onPress: onYes }]);
  return <View style={{ gap: 12 }}>
    <Text style={ui.text}>{t("pv.intro")}</Text>
    <Message error={err} ok={ok} />
    {list.map(p => <View key={p.id} style={[ui.card, { borderLeftWidth: 4, borderLeftColor: p.active ? "#2E7D32" : C.line }]}>
      <Text style={ui.h2}>{p.name} · {p.active ? t("pv.on") : t("pv.off")}</Text>
      <Text style={ui.muted}>{t("pv.counts", { m: p.municipalities, l: p.listings })}</Text>
      <Button title={t("pv.manage")} variant="secondary" onPress={() => setOpen(open === p.id ? null : p.id)} />
      {p.active
        ? <Button title={t("pv.lock")} variant="danger" disabled={busy} onPress={() => ask(t("pv.lock"), t("pv.confirm_lock", { p: p.name }), () => void run(() => setProvinceActive(supabase(), p.id, false), t("pv.ok_locked")))} />
        : <Button title={t("pv.unlock")} disabled={busy} onPress={() => ask(t("pv.unlock"), t("pv.confirm_unlock", { p: p.name }), () => void run(() => setProvinceActive(supabase(), p.id, true), t("pv.ok_unlocked")))} />}
      {open === p.id && <Municipalities provinceId={p.id} run={run} busy={busy} />}
    </View>)}
  </View>;
}

function Municipalities({ provinceId, run, busy }: { provinceId: string; busy: boolean; run: Run }) {
  const { t } = useT();
  const [items, setItems] = useState<{ id: string; name: string }[]>([]); const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null); const [name, setName] = useState("");
  async function load() { const r = await adminListMunicipalities(supabase(), provinceId); setItems(r.data); }
  useEffect(() => { void load(); }, [provinceId]);
  return <View style={{ gap: 8 }}>
    {!items.length && <Text style={ui.muted}>{t("pv.none")}</Text>}
    {items.map(m => <View key={m.id} style={{ gap: 4, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6 }}>
      {editing === m.id ? <>
        <TextInput style={ui.input} value={name} onChangeText={setName} accessibilityLabel={t("pv.rename_q")} />
        <Button title={t("pv.rename")} disabled={busy || !name.trim()} onPress={() => void run(() => renameMunicipality(supabase(), m.id, name), t("pv.ok_saved")).then(ok => { if (ok) { setEditing(null); void load(); } })} />
      </> : <>
        <Text style={ui.text}>{m.name}</Text>
        <View style={ui.row}>
          <Button title={t("pv.rename")} variant="secondary" onPress={() => { setEditing(m.id); setName(m.name); }} />
          <Button title={t("pv.delete")} variant="danger" disabled={busy} onPress={() => Alert.alert(t("pv.delete"), t("pv.confirm_delete", { m: m.name }), [
            { text: t("common.cancel"), style: "cancel" }, { text: t("pv.delete"), style: "destructive", onPress: () => void run(() => deleteMunicipality(supabase(), m.id), t("pv.ok_saved")).then(ok => { if (ok) void load(); }) }])} />
        </View>
      </>}
    </View>)}
    <Text style={ui.label}>{t("pv.add_label")}</Text>
    <TextInput style={[ui.input, ui.area]} multiline value={text} onChangeText={setText} accessibilityLabel={t("pv.add_label")} />
    <Button title={t("pv.add")} disabled={busy || !text.trim()} onPress={() => void run(() => addMunicipalities(supabase(), provinceId, text), r => t("pv.added", { n: Number(r.data ?? 0) })).then(ok => { if (ok) { setText(""); void load(); } })} />
  </View>;
}
