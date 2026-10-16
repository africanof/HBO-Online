"use client";
import { useEffect, useState } from "react";
import { listMarkets, suggestMarket, friendlyErrorIn, type Market } from "@huambo-online/core";
import { useT, marketSummaryIn } from "../../lib/i18n";
import { supabase, currentUserId } from "../../lib/supabase";
import { useTerritory } from "../../components/Directory";
import { LiteImg } from "../../components/LiteImg";

export default function Pracas() {
  const { lang, t } = useT();
  const [q, setQ] = useState(""); const [municipalityId, setMunicipalityId] = useState("");
  const { municipalities } = useTerritory();
  const [items, setItems] = useState<Market[] | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ open: false, name: "", municipalityId: "", addressText: "", description: "" }); const [busy, setBusy] = useState(false);
  useEffect(() => { const start = new URLSearchParams(window.location.search).get("q") ?? ""; setQ(start); void search(undefined, start); }, []);
  async function search(e?: React.FormEvent, query = q) {
    e?.preventDefault(); setError("");
    const r = await listMarkets(supabase(), { query, municipalityId });
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems((r.data as Market[]) ?? []);
  }
  async function suggest(e: React.FormEvent) {
    e.preventDefault(); setError(""); setNotice("");
    if (!(await currentUserId())) { window.location.href = "/conta/login?voltar=/pracas"; return; }
    setBusy(true);
    const r = await suggestMarket(supabase(), form); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("sv.mk_thanks")); setForm({ open: false, name: "", municipalityId: "", addressText: "", description: "" }); }
  }
  return <main className="stack">
    <a href="/">← {t("nav.home")}</a>
    <section className="banner yellow">
      <div><h1 style={{ margin: 0 }}>🧺 {t("sv.mk_title")}</h1><p>{t("sv.mk_intro")}</p></div>
    </section>
    <form onSubmit={search} className="row">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("sv.mk_search_ph")} style={{ maxWidth: 360 }} aria-label={t("sv.mk_search")} />
      <select value={municipalityId} onChange={e => setMunicipalityId(e.target.value)} style={{ maxWidth: 240 }} aria-label={t("sv.municipality")}><option value="">{t("sv.all_municipalities")}</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
      <button type="submit">{t("sv.search_btn")}</button>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items?.length === 0 && <p>{t("sv.mk_none")}</p>}
    <section className="grid">
      {items?.map(m => <a key={m.id} href={"/pracas/" + m.id} className="item card" style={{ padding: 12 }}>
        <div className="item-img" style={{ aspectRatio: "16/9" }}>{m.photo_url ? <LiteImg src={m.photo_url} alt="" loading="lazy" placeholder="🧺" /> : <span aria-hidden>🧺</span>}</div>
        <strong style={{ fontSize: 19 }}>{m.name}</strong>
        <span className="item-meta">📍 {[m.address_text, m.municipality_name].filter(Boolean).join(", ") || "Huambo"}</span>
        {m.opening_hours && <span className="item-meta">🕘 {m.opening_hours}</span>}
        <span><strong>{marketSummaryIn(m, t)}</strong></span>
      </a>)}
    </section>
    <section className="card">
      <h2 style={{ margin: 0 }}>{t("sv.mk_missing")}</h2>
      {!form.open ? <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => setForm({ ...form, open: true })}>+ {t("sv.mk_suggest")}</button> :
        <form className="stack" onSubmit={suggest}>
          <label>{t("sv.mk_name")}<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t("sv.mk_name_ph")} /></label>
          <label>{t("sv.municipality")}<select value={form.municipalityId} onChange={e => setForm({ ...form, municipalityId: e.target.value })}><option value="">{t("sv.choose")}</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          <label>{t("sv.mk_area")}<input value={form.addressText} onChange={e => setForm({ ...form, addressText: e.target.value })} /></label>
          <label>{t("sv.mk_what")}<textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
          <div className="row"><button disabled={busy}>{t("sv.mk_send")}</button><button type="button" className="secondary" onClick={() => setForm({ ...form, open: false })}>{t("common.cancel")}</button></div>
        </form>}
    </section>
  </main>;
}
