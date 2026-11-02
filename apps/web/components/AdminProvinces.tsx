"use client";
import { useEffect, useState } from "react";
import { adminListProvinces, setProvinceActive, adminListMunicipalities, addMunicipalities, renameMunicipality, deleteMunicipality,
  friendlyErrorIn, type AdminProvince } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT } from "../lib/i18n";

/** Painel: desbloquear as províncias e gerir os municípios de cada uma. */
export function AdminProvinces() {
  const { lang, t } = useT();
  const [list, setList] = useState<AdminProvince[]>([]); const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);
  async function load() { const r = await adminListProvinces(supabase()); if (r.error) setErr(friendlyErrorIn(r.error, lang)); else setList(r.data); }
  useEffect(() => { void load(); }, []);
  async function run(fn: () => PromiseLike<{ data?: any; error: any }>, message: string | ((r: { data?: any }) => string)) {
    setBusy(true); setErr(""); setOk("");
    const r = await fn(); setBusy(false);
    if (r.error) { setErr(friendlyErrorIn(r.error, lang)); return false; }
    setOk(typeof message === "function" ? message(r) : message); await load(); return true;
  }
  return <section className="stack">
    <p style={{ margin: 0 }}>{t("pv.intro")}</p>
    {err && <p className="error" role="alert">{err}</p>}
    {ok && <p className="ok" role="status">{ok}</p>}
    {list.map(p => <article key={p.id} className="card" style={{ borderLeft: `4px solid ${p.active ? "var(--green, #2E7D32)" : "var(--line, #ccc)"}` }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <span><strong>{p.name}</strong> · {p.active ? t("pv.on") : t("pv.off")}<br /><small>{t("pv.counts", { m: p.municipalities, l: p.listings })}</small></span>
        <div className="row">
          <button className="secondary" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id}>{t("pv.manage")}</button>
          {p.active
            ? <button className="danger" disabled={busy} onClick={() => { if (confirm(t("pv.confirm_lock", { p: p.name }))) void run(() => setProvinceActive(supabase(), p.id, false), t("pv.ok_locked")); }}>{t("pv.lock")}</button>
            : <button disabled={busy} onClick={() => { if (confirm(t("pv.confirm_unlock", { p: p.name }))) void run(() => setProvinceActive(supabase(), p.id, true), t("pv.ok_unlocked")); }}>{t("pv.unlock")}</button>}
        </div>
      </div>
      {open === p.id && <Municipalities provinceId={p.id} run={run} busy={busy} />}
    </article>)}
  </section>;
}

type Run = (fn: () => PromiseLike<{ data?: any; error: any }>, message: string | ((r: { data?: any }) => string)) => Promise<boolean>;
function Municipalities({ provinceId, run, busy }: { provinceId: string; busy: boolean; run: Run }) {
  const { t } = useT();
  const [items, setItems] = useState<{ id: string; name: string }[]>([]); const [text, setText] = useState("");
  async function load() { const r = await adminListMunicipalities(supabase(), provinceId); setItems(r.data); }
  useEffect(() => { void load(); }, [provinceId]);
  async function add() {
    if (await run(() => addMunicipalities(supabase(), provinceId, text), r => t("pv.added", { n: Number(r.data ?? 0) }))) { setText(""); await load(); }
  }
  return <div className="stack" style={{ gap: 8, marginTop: 8 }}>
    {!items.length && <small>{t("pv.none")}</small>}
    {items.map(m => <div key={m.id} className="row" style={{ alignItems: "center", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 4 }}>
      <span style={{ flex: 1 }}>{m.name}</span>
      <button className="secondary" style={{ minHeight: 36, padding: "4px 12px" }} disabled={busy} onClick={() => { const v = prompt(t("pv.rename_q"), m.name); if (v?.trim() && v.trim() !== m.name) void run(() => renameMunicipality(supabase(), m.id, v), t("pv.ok_saved")).then(ok => { if (ok) void load(); }); }}>{t("pv.rename")}</button>
      <button className="danger" style={{ minHeight: 36, padding: "4px 12px" }} disabled={busy} onClick={() => { if (confirm(t("pv.confirm_delete", { m: m.name }))) void run(() => deleteMunicipality(supabase(), m.id), t("pv.ok_saved")).then(ok => { if (ok) void load(); }); }}>{t("pv.delete")}</button>
    </div>)}
    <label>{t("pv.add_label")}<textarea rows={4} value={text} onChange={e => setText(e.target.value)} /></label>
    <button style={{ justifySelf: "start" }} disabled={busy || !text.trim()} onClick={() => void add()}>{t("pv.add")}</button>
  </div>;
}
