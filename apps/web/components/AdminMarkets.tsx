"use client";
import { useEffect, useState } from "react";
import { listMarketsForAdmin, saveMarket, setMarketStatus, friendlyErrorIn, MARKET_STATUS_LABELS, type MarketStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useTerritory } from "./Directory";
import { useT } from "../lib/i18n";

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
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  return <section className="stack">
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <h2>{t("ad.markets_title", { n: items.length })}</h2>
    {items.map(m => <div key={m.id} className="card">
      <strong>{m.name} · <span className="badge">{tc(MARKET_STATUS_LABELS[m.status as MarketStatus])}</span></strong>
      <span className="item-meta">{[m.address_text, m.municipalities?.name, m.opening_hours].filter(Boolean).join(" · ") || t("ad.market_no_address")}</span>
      {m.description && <span>{m.description}</span>}
      <div className="row">
        {m.status !== "active" && <button onClick={() => act(() => setMarketStatus(supabase(), m.id, "active"), t("ad.ok_market_visible"))}>{m.status === "pending" ? t("ad.approve") : t("ad.show")}</button>}
        {m.status !== "hidden" && <button className="secondary" onClick={() => act(() => setMarketStatus(supabase(), m.id, "hidden"), t("ad.ok_market_hidden"))}>{t("ad.hide")}</button>}
        <button className="secondary" onClick={() => { setEditing(m.id); setForm({ name: m.name, municipalityId: m.municipality_id ?? "", addressText: m.address_text ?? "", openingHours: m.opening_hours ?? "", photoUrl: m.photo_url ?? "", description: m.description ?? "" }); }}>{t("common.edit")}</button>
      </div>
    </div>)}
    <form className="card stack" onSubmit={e => { e.preventDefault(); const status = items.find(i => i.id === editing)?.status ?? "active"; void act(() => saveMarket(supabase(), { ...form, status }, editing ?? undefined), editing ? t("ad.ok_market_updated") : t("ad.ok_market_added")); }}>
      <h2 style={{ margin: 0 }}>{editing ? t("ad.market_edit") : t("ad.market_add")}</h2>
      <label>{t("ad.f_name")}<input value={form.name} onChange={set("name")} placeholder={t("ad.f_name_ph")} /></label>
      <label>{t("ad.f_municipality")}<select value={form.municipalityId} onChange={set("municipalityId")}><option value="">{t("ad.choose")}</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label>{t("ad.f_address")}<input value={form.addressText} onChange={set("addressText")} /></label>
      <label>{t("ad.f_hours")}<input value={form.openingHours} onChange={set("openingHours")} placeholder={t("ad.f_hours_ph")} /></label>
      <label>{t("ad.f_photo")}<input value={form.photoUrl} onChange={set("photoUrl")} /></label>
      <label>{t("ad.f_description")}<textarea rows={3} value={form.description} onChange={set("description")} placeholder={t("ad.f_description_ph")} /></label>
      <div className="row"><button>{editing ? t("common.save") : t("ad.add")}</button>{editing && <button type="button" className="secondary" onClick={() => { setEditing(null); setForm(empty); }}>{t("common.cancel")}</button>}</div>
    </form>
  </section>;
}
