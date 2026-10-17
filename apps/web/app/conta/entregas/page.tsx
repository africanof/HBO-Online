"use client";
import { useEffect, useState } from "react";
import { getDeliveryPolicy, saveDeliverySettings, clearDeliverySettings, deliveryPolicyLines, validateDeliverySettings, parsePrice, formatPrice, friendlyErrorIn,
  type DeliveryPolicy, type DeliverySettingsInput } from "@huambo-online/core";
import { supabase, currentUserId } from "../../../lib/supabase";
import { useTerritory } from "../../../components/Directory";
import { MunicipalitySelect } from "../../../components/SellerDelivery";
import { useT } from "../../../lib/i18n";

/**
 * 🚚 Entregas do vendedor: levantamento no local e/ou entrega, preço por município (e para os outros), entrega grátis a partir de
 * um valor, valor mínimo para entregar, prazo e nota. O carrinho calcula a taxa com estas regras (produtos da Loja).
 */
type Zone = { municipalityId: string; name: string; fee: string };
type Form = { pickupEnabled: boolean; pickupPlace: string; deliveryEnabled: boolean; defaultFee: string; freeOver: string; minOrder: string; days: string; note: string; zones: Zone[] };
const EMPTY: Form = { pickupEnabled: true, pickupPlace: "", deliveryEnabled: true, defaultFee: "", freeOver: "", minOrder: "", days: "", note: "", zones: [] };
const str = (n: number | null | undefined) => n == null ? "" : String(n);

function fromPolicy(p: DeliveryPolicy): Form {
  return { pickupEnabled: p.pickup_enabled, pickupPlace: p.pickup_place ?? "", deliveryEnabled: p.delivery_enabled, defaultFee: str(p.default_fee),
    freeOver: str(p.free_over), minOrder: str(p.min_order), days: p.delivery_days ?? "", note: p.note ?? "",
    zones: p.zones.map(z => ({ municipalityId: z.municipality_id, name: z.municipality_name ?? "", fee: String(z.fee) })) };
}
/** Valor opcional: vazio → null; texto que não é número → NaN (a validação avisa). */
const optional = (s: string) => { const v = parsePrice(s); return v === undefined ? null : v; };
function toInput(f: Form): DeliverySettingsInput {
  return { pickupEnabled: f.pickupEnabled, pickupPlace: f.pickupPlace, deliveryEnabled: f.deliveryEnabled, defaultFee: optional(f.defaultFee),
    freeOver: optional(f.freeOver), minOrder: optional(f.minOrder), deliveryDays: f.days, note: f.note,
    zones: f.zones.map(z => ({ municipalityId: z.municipalityId, fee: parsePrice(z.fee) ?? NaN })) };
}
function toPolicy(f: Form): DeliveryPolicy {
  const i = toInput(f); const ok = (n: number | null) => n != null && Number.isFinite(n) ? n : null;
  return { pickup_enabled: i.pickupEnabled, pickup_place: f.pickupPlace.trim() || null, delivery_enabled: i.deliveryEnabled, default_fee: ok(i.defaultFee),
    free_over: ok(i.freeOver), min_order: ok(i.minOrder), delivery_days: f.days.trim() || null, note: f.note.trim() || null,
    zones: f.zones.filter(z => Number.isFinite(parsePrice(z.fee) ?? NaN)).map(z => ({ municipality_id: z.municipalityId, municipality_name: z.name, fee: parsePrice(z.fee)! })) };
}

export default function Entregas() {
  const { lang, t, tc } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [configured, setConfigured] = useState(false); const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const { provinces, municipalities, provinceId, setProvinceId } = useTerritory();
  const [newMuni, setNewMuni] = useState<{ id: string; name: string }>({ id: "", name: "" }); const [newFee, setNewFee] = useState("");

  async function load(id: string) {
    const r = await getDeliveryPolicy(supabase(), id);
    if (r.error) setError(friendlyErrorIn(r.error, lang));
    else { setConfigured(!!r.data); setForm(r.data ? fromPolicy(r.data) : EMPTY); }
    setLoaded(true);
  }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(id); }); }, []);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setForm(f => ({ ...f, [k]: v })); setNotice(""); };

  function addZone() {
    setError("");
    if (!newMuni.id) { setError(t("sh.dl.pick_muni")); return; }
    const fee = parsePrice(newFee);
    if (fee === undefined || !Number.isFinite(fee) || fee < 0) { setError(t("sh.dl.bad_fee")); return; }
    if (form.zones.some(z => z.municipalityId === newMuni.id)) { setError(tc("O mesmo município aparece duas vezes.")); return; }
    set("zones", [...form.zones, { municipalityId: newMuni.id, name: newMuni.name, fee: String(fee) }]);
    setNewMuni({ id: "", name: "" }); setNewFee("");
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!uid || busy) return;
    setError(""); setNotice("");
    const input = toInput(form);
    if ([input.defaultFee, input.freeOver, input.minOrder].some(v => v != null && !Number.isFinite(v))) { setError(t("sh.dl.bad_number")); return; }
    const bad = validateDeliverySettings(input); if (bad) { setError(tc(bad)); return; }
    setBusy(true);
    const r = await saveDeliverySettings(supabase(), uid, input); setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    setNotice(t("sh.dl.saved")); await load(uid);
  }
  async function clear() {
    if (!uid || busy || !confirm(t("sh.dl.clear_q"))) return;
    setError(""); setNotice(""); setBusy(true);
    const r = await clearDeliverySettings(supabase(), uid); setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    setNotice(t("sh.dl.cleared")); await load(uid);
  }

  if (uid === undefined || (uid && !loaded)) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main><a href="/conta">← {t("nav.account_short")}</a><h1>{t("sh.dl.title")}</h1><p><a href="/conta/login?voltar=/conta/entregas">{t("sh.sign_in")}</a> {t("sh.dl.to_set")}</p></main>;

  const preview = deliveryPolicyLines(toPolicy(form));
  return <main className="stack" style={{ maxWidth: 760 }}>
    <a href="/conta">← {t("nav.account_short")}</a>
    <h1>{t("sh.dl.title")}</h1>
    <p style={{ margin: 0 }}>{t("sh.dl.intro")}</p>
    <p className="badge" style={{ justifySelf: "start", whiteSpace: "normal" }}>{configured ? "✅ " + t("sh.dl.state_set") : "🤝 " + t("sh.dl.state_unset")}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <form className="stack" onSubmit={save}>
      <section className="card">
        <label className="dl-check"><input type="checkbox" checked={form.pickupEnabled} onChange={e => set("pickupEnabled", e.target.checked)} /> 🏪 {t("sh.dl.pickup_on")}</label>
        {form.pickupEnabled && <label>{t("sh.dl.pickup_place")}<input value={form.pickupPlace} maxLength={300} onChange={e => set("pickupPlace", e.target.value)} placeholder={t("sh.dl.pickup_place_ph")} /></label>}
      </section>
      <section className="card">
        <label className="dl-check"><input type="checkbox" checked={form.deliveryEnabled} onChange={e => set("deliveryEnabled", e.target.checked)} /> 🚚 {t("sh.dl.delivery_on")}</label>
        {form.deliveryEnabled && <>
          <h2 style={{ margin: "8px 0 0", fontSize: 20 }}>{t("sh.dl.zones_title")}</h2>
          <p className="muted" style={{ margin: 0 }}>{t("sh.dl.zones_help")}</p>
          {form.zones.length === 0 && <p style={{ margin: 0 }}>{t("sh.dl.no_zones")}</p>}
          {form.zones.length > 0 && <ul style={{ listStyle: "none", padding: 0, margin: 0 }} aria-label={t("sh.dl.zones_title")}>
            {form.zones.map((z, i) => <li key={z.municipalityId} className="dl-zone">
              <label>📍 {z.name || t("auth.municipality")}
                <input inputMode="numeric" value={z.fee} aria-label={t("sh.dl.zone_fee_for", { name: z.name })} onChange={e => set("zones", form.zones.map((x, j) => j === i ? { ...x, fee: e.target.value } : x))} />
              </label>
              <button type="button" className="secondary" style={{ alignSelf: "end" }} aria-label={t("sh.dl.remove_zone", { name: z.name })} onClick={() => set("zones", form.zones.filter((_, j) => j !== i))}>{t("sh.remove")}</button>
            </li>)}
          </ul>}
          <div className="card stack" style={{ background: "var(--surface)" }}>
            <strong>{t("sh.dl.add_title")}</strong>
            <MunicipalitySelect idPrefix="dl-zone" provinces={provinces} municipalities={municipalities} provinceId={provinceId} setProvinceId={setProvinceId}
              value={newMuni.id} onChange={(id, name) => setNewMuni({ id, name })} exclude={form.zones.map(z => z.municipalityId)} />
            <label>{t("sh.dl.zone_fee")}<input inputMode="numeric" value={newFee} onChange={e => setNewFee(e.target.value)} placeholder="1500" /></label>
            <button type="button" className="secondary" onClick={addZone} style={{ justifySelf: "start" }}>＋ {t("sh.dl.add_zone")}</button>
          </div>
          <label>{t("sh.dl.default_fee")}<input inputMode="numeric" value={form.defaultFee} onChange={e => set("defaultFee", e.target.value)} placeholder="3000" aria-describedby="dl-default-help" /></label>
          <small id="dl-default-help" className="muted" style={{ marginTop: -4 }}>{t("sh.dl.default_fee_help")}</small>
          <label>{t("sh.dl.free_over")}<input inputMode="numeric" value={form.freeOver} onChange={e => set("freeOver", e.target.value)} placeholder="50000" /></label>
          <label>{t("sh.dl.min_order")}<input inputMode="numeric" value={form.minOrder} onChange={e => set("minOrder", e.target.value)} placeholder="5000" /></label>
          <label>{t("sh.dl.days")}<input value={form.days} maxLength={120} onChange={e => set("days", e.target.value)} placeholder={t("sh.dl.days_ph")} /></label>
        </>}
        <label>{t("sh.dl.note")}<input value={form.note} maxLength={300} onChange={e => set("note", e.target.value)} placeholder={t("sh.dl.note_ph")} /></label>
      </section>
      <section className="card dl-preview" aria-live="polite">
        <h2 style={{ margin: 0, fontSize: 20 }}>{t("sh.dl.preview")}</h2>
        <strong>{t("sh.dl.box_title")}</strong>
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 4 }}>{preview.map((l, i) => <li key={i}>{tc(l)}</li>)}</ul>
        {form.deliveryEnabled && form.zones.length > 0 && <p className="muted" style={{ margin: 0 }}>{form.zones.map(z => `${z.name}: ${Number.isFinite(parsePrice(z.fee) ?? NaN) ? formatPrice(parsePrice(z.fee)!) : "—"}`).join(" · ")}</p>}
      </section>
      <button disabled={busy}>{busy ? t("sh.sending") : "💾 " + t("sh.dl.save")}</button>
    </form>
    {configured && <section className="card">
      <p style={{ margin: 0 }}>{t("sh.dl.clear_text")}</p>
      <button type="button" className="danger" disabled={busy} onClick={clear} style={{ justifySelf: "start" }}>🤝 {t("sh.dl.clear")}</button>
    </section>}
  </main>;
}
