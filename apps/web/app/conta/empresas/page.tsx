"use client";
import { MarketPicker } from "../../../components/MarketPicker";
import { useEffect, useState } from "react";
import { listMyBusinesses, saveBusiness, setBusinessLogo, deleteBusiness, listDirectoryCategories, friendlyErrorIn, OTHER_CATEGORY, categoryFormValues, pointFrom, type GeoPoint } from "@huambo-online/core";
import { PlaceFields } from "../../../components/Place";
import { supabase, currentUserId } from "../../../lib/supabase";
import { useT } from "../../../lib/i18n";
import { useTerritory } from "../../../components/Directory";
import { PlanBanner } from "../../../components/Plans";
import { PhotoPicker, PortfolioManager } from "../../../components/Portfolio";
import { ProfileQr } from "../../../components/ProfileQr";

type Option = { id: string; name: string };
const empty = { name: "", description: "", categoryId: "", customCategory: "", municipalityId: "", marketId: "", phone: "", whatsapp: "", addressText: "", active: true, directions: "", point: null as GeoPoint | null };

export default function MinhasEmpresas() {
  const { lang, t } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<any[]>([]); const [form, setForm] = useState(empty); const [editing, setEditing] = useState<string | null>(null); const [showcase, setShowcase] = useState<string | null>(null);
  const [categories, setCategories] = useState<Option[]>([]); const { provinces, municipalities, provinceId, setProvinceId } = useTerritory();
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);

  async function load(id: string) { const r = await listMyBusinesses(supabase(), id); setItems(r.data ?? []); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(id); }); void listDirectoryCategories(supabase(), "businesses").then(({ data }) => setCategories(data ?? [])); }, []);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!uid) return;
    setBusy(true); setError(""); setNotice("");
    const r = await saveBusiness(supabase(), uid, form, editing ?? undefined); setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    setNotice(editing ? t("sv.biz_updated") : t("sv.biz_created")); setForm(empty); setEditing(null); await load(uid);
  }

  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main><a href="/empresas">← {t("nav.businesses")}</a><h1>{t("sv.biz_mine")}</h1><p>{t("sv.biz_login")} <a href="/conta/login?voltar=/conta/empresas">{t("sv.login_link")}</a>.</p></main>;

  return <main className="stack" style={{ maxWidth: 720 }}>
    <a href="/conta">← {t("nav.account_short")}</a>
    <h1>{t("sv.biz_mine")}</h1>
    <a className="btn secondary" href="/conta/estatisticas" style={{ justifySelf: "start" }}>📊 {t("sv.f_stats")}</a>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items.map(b => <div key={b.id} className="card">
      <strong>{b.name}{b.verified ? " ✔️" : ""}{b.active ? "" : " " + t("sv.biz_hidden")}</strong>
      <PlanBanner kind="business" subjectId={b.id} />
      <ProfileQr kind="empresas" id={b.id} name={b.name ?? ""} owner />
      <div className="row">
        <a className="btn secondary" href={"/empresas/" + b.id}>{t("sv.view")}</a>
        <button className={showcase === b.id ? "" : "secondary"} aria-expanded={showcase === b.id} onClick={() => setShowcase(showcase === b.id ? null : b.id)}>📸 {t("sv.biz_logo_portfolio")}</button>
        <button className="secondary" onClick={() => { setEditing(b.id); setForm({ name: b.name ?? "", description: b.description ?? "", ...categoryFormValues(b), municipalityId: b.municipality_id ?? "", marketId: b.market_id ?? "", phone: b.phone ?? "", whatsapp: b.whatsapp ?? "", addressText: b.address_text ?? "", active: b.active, directions: b.directions ?? "", point: pointFrom(b.geo_lat, b.geo_lng) }); window.scrollTo(0, document.body.scrollHeight); }}>{t("common.edit")}</button>
        <button className="danger" onClick={async () => { if (!confirm(t("sv.biz_delete_q"))) return; const r = await deleteBusiness(supabase(), b.id); if (r.error) setError(friendlyErrorIn(r.error, lang)); else await load(uid); }}>{t("common.delete")}</button>
      </div>
      {showcase === b.id && <div className="stack" style={{ marginTop: 8 }}>
        <strong>{t("sv.biz_logo")}</strong>
        <PhotoPicker uid={uid} current={b.logo_url ?? null} label={t("sv.biz_logo")} onSave={url => setBusinessLogo(supabase(), b.id, url)} />
        <PortfolioManager uid={uid} target={{ businessId: b.id }} />
      </div>}
    </div>)}
    <form className="stack card" onSubmit={submit}>
      <h2 style={{ margin: 0 }}>{editing ? t("sv.biz_edit") : t("sv.biz_register")}</h2>
      <label>{t("sv.f_name")}<input value={form.name} onChange={set("name")} /></label>
      <label>{t("sv.f_description")}<textarea rows={4} value={form.description} onChange={set("description")} placeholder={t("sv.biz_desc_ph")} /></label>
      <label>{t("sv.f_category")}<select value={form.categoryId} onChange={set("categoryId")}><option value="">{t("sv.f_choose")}</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}<option value={OTHER_CATEGORY}>{t("sv.f_other_cat")}</option></select></label>
      {form.categoryId === OTHER_CATEGORY && <label>{t("sv.f_other_q")}<input value={form.customCategory} onChange={set("customCategory")} maxLength={60} placeholder={t("sv.f_other_ph")} autoFocus /></label>}
      <label>{t("sv.f_province")}<select value={provinceId} onChange={e => { setProvinceId(e.target.value); setForm({ ...form, municipalityId: "" }); }}><option value="">{t("sv.f_choose")}</option>{provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>{t("sv.municipality")}<select value={form.municipalityId} onChange={set("municipalityId")}><option value="">{t("sv.f_choose")}</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <MarketPicker value={form.marketId} onChange={v => setForm({ ...form, marketId: v })} />
      <label>{t("sv.biz_address")}<input value={form.addressText} onChange={set("addressText")} placeholder={t("sv.biz_address_ph")} /></label>
      <PlaceFields directions={form.directions} point={form.point} onDirections={v => setForm({ ...form, directions: v })} onPoint={p => setForm({ ...form, point: p })} />
      <label>{t("auth.phone")}<input type="tel" value={form.phone} onChange={set("phone")} /></label>
      <label>WhatsApp<input type="tel" value={form.whatsapp} onChange={set("whatsapp")} /></label>
      <label style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} style={{ width: 24, height: 24 }} /> {t("sv.biz_visible")}</label>
      <div className="row"><button disabled={busy}>{editing ? t("common.save") : t("sv.biz_register")}</button>{editing && <button type="button" className="secondary" onClick={() => { setEditing(null); setForm(empty); }}>{t("common.cancel")}</button>}</div>
    </form>
  </main>;
}
