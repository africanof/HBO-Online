"use client";
import { useEffect, useState } from "react";
import { getProvider, saveMyProviderProfile, setProviderPhoto, listProviderServices, saveService, deleteService, listDirectoryCategories, friendlyErrorIn, parsePrice, formatPrice, OTHER_CATEGORY, categoryFormValues, pointFrom, type GeoPoint } from "@huambo-online/core";
import { PlaceFields } from "../../../components/Place";
import { supabase, currentUserId } from "../../../lib/supabase";
import { useT } from "../../../lib/i18n";
import { useTerritory } from "../../../components/Directory";
import { PlanBanner } from "../../../components/Plans";
import { PhotoPicker, PortfolioManager } from "../../../components/Portfolio";

type Option = { id: string; name: string };
const empty = { displayName: "", headline: "", bio: "", categoryId: "", customCategory: "", municipalityId: "", phone: "", whatsapp: "", active: true, directions: "", point: null as GeoPoint | null };

export default function PerfilProfissional() {
  const { lang, t } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [form, setForm] = useState(empty); const [exists, setExists] = useState(false); const [avatar, setAvatar] = useState<string | null>(null);
  const [services, setServices] = useState<any[]>([]); const [svc, setSvc] = useState({ title: "", description: "", price: "" });
  const [categories, setCategories] = useState<Option[]>([]); const { provinces, municipalities, provinceId, setProvinceId } = useTerritory();
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);

  async function load(id: string) {
    const c = supabase();
    const p = await getProvider(c, id);
    if (p.data) { setExists(true); setAvatar(p.data.avatar_url ?? null); setForm({ displayName: p.data.display_name ?? "", headline: p.data.headline ?? "", bio: p.data.bio ?? "", ...categoryFormValues(p.data), municipalityId: p.data.municipality_id ?? "", phone: p.data.phone ?? "", whatsapp: p.data.whatsapp ?? "", active: p.data.active, directions: p.data.directions ?? "", point: pointFrom(p.data.geo_lat, p.data.geo_lng) }); }
    const s = await listProviderServices(c, id, true); setServices(s.data ?? []);
  }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(id); }); void listDirectoryCategories(supabase(), "providers").then(({ data }) => setCategories(data ?? [])); }, []);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  async function run(fn: () => PromiseLike<{ error: any }>, ok: string) {
    setBusy(true); setError(""); setNotice("");
    const r = await fn(); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(ok); if (uid) await load(uid); }
    return !r.error;
  }

  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main><a href="/profissionais">← {t("sv.pro_list")}</a><h1>{t("sv.pro_profile")}</h1><p>{t("sv.pro_login")} <a href="/conta/login?voltar=/conta/profissional">{t("sv.login_link")}</a>.</p></main>;

  return <main className="stack" style={{ maxWidth: 720 }}>
    <a href="/conta">← {t("nav.account_short")}</a>
    <h1>{exists ? t("sv.pro_mine") : t("sv.pro_create_title")}</h1>
    {exists && <a className="btn secondary" href="/conta/estatisticas" style={{ justifySelf: "start" }}>📊 {t("sv.f_stats")}</a>}
    <p>{t("sv.pro_intro")}</p>
    {exists && <a href={"/profissionais/" + uid}>{t("sv.pro_public")} →</a>}
    {exists && <PlanBanner kind="provider" subjectId={uid} />}
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <form className="stack card" onSubmit={e => { e.preventDefault(); void run(() => saveMyProviderProfile(supabase(), uid, form), t("sv.pro_saved")); }}>
      <label>{t("sv.pro_name")}<input value={form.displayName} onChange={set("displayName")} placeholder={t("sv.pro_name_ph")} /></label>
      <label>{t("sv.pro_headline")}<input value={form.headline} onChange={set("headline")} placeholder={t("sv.pro_headline_ph")} /></label>
      <label>{t("sv.pro_bio")}<textarea rows={4} value={form.bio} onChange={set("bio")} placeholder={t("sv.pro_bio_ph")} /></label>
      <label>{t("sv.pro_area")}<select value={form.categoryId} onChange={set("categoryId")}><option value="">{t("sv.f_choose")}</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}<option value={OTHER_CATEGORY}>{t("sv.f_other_cat")}</option></select></label>
      {form.categoryId === OTHER_CATEGORY && <label>{t("sv.f_other_q")}<input value={form.customCategory} onChange={set("customCategory")} maxLength={60} placeholder={t("sv.f_other_ph")} autoFocus /></label>}
      <label>{t("sv.f_province")}<select value={provinceId} onChange={e => { setProvinceId(e.target.value); setForm({ ...form, municipalityId: "" }); }}><option value="">{t("sv.f_choose")}</option>{provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>{t("sv.municipality")}<select value={form.municipalityId} onChange={set("municipalityId")}><option value="">{t("sv.f_choose")}</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label>{t("auth.phone")}<input type="tel" value={form.phone} onChange={set("phone")} placeholder="923 000 000" /></label>
      <label>WhatsApp<input type="tel" value={form.whatsapp} onChange={set("whatsapp")} placeholder="923 000 000" /></label>
      <PlaceFields directions={form.directions} point={form.point} onDirections={v => setForm({ ...form, directions: v })} onPoint={p => setForm({ ...form, point: p })} hint={t("sv.pro_place_hint")} />
      <label style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} style={{ width: 24, height: 24 }} /> {t("sv.pro_visible")}</label>
      <button disabled={busy}>{exists ? t("sv.pro_save") : t("sv.pro_create")}</button>
    </form>
    {exists && <section className="card stack"><h2 style={{ margin: 0 }}>{t("sv.pro_photo")}</h2>
      <PhotoPicker uid={uid} current={avatar} label={t("sv.photo")} onSave={url => setProviderPhoto(supabase(), uid, url)} /></section>}
    {exists && <PortfolioManager uid={uid} target={{ providerId: uid }} />}
    {exists && <section className="stack">
      <h2>{t("sv.pro_services")}</h2>
      <form className="stack card" onSubmit={e => { e.preventDefault(); void run(() => saveService(supabase(), uid, { title: svc.title, description: svc.description, priceFrom: parsePrice(svc.price), categoryId: form.categoryId === OTHER_CATEGORY ? undefined : form.categoryId }), t("sv.pro_svc_added")).then(ok => { if (ok) setSvc({ title: "", description: "", price: "" }); }); }}>
        <label>{t("sv.pro_svc")}<input value={svc.title} onChange={e => setSvc({ ...svc, title: e.target.value })} placeholder={t("sv.pro_svc_ph")} /></label>
        <label>{t("sv.f_description")}<input value={svc.description} onChange={e => setSvc({ ...svc, description: e.target.value })} /></label>
        <label>{t("sv.pro_price_from")}<input value={svc.price} inputMode="decimal" onChange={e => setSvc({ ...svc, price: e.target.value })} placeholder={t("sv.pro_price_ph")} /></label>
        <button disabled={busy}>{t("sv.pro_add_svc")}</button>
      </form>
      {services.map(s => <div key={s.id} className="card row" style={{ justifyContent: "space-between" }}>
        <span><strong>{s.title}</strong> · {s.price_from != null ? t("sv.from_price", { price: formatPrice(s.price_from, s.currency) }) : t("sv.on_request")}</span>
        <button className="danger" onClick={() => { if (confirm(t("sv.pro_svc_delete_q"))) void run(() => deleteService(supabase(), s.id), t("sv.pro_svc_deleted")); }}>{t("common.delete")}</button>
      </div>)}
    </section>}
  </main>;
}
