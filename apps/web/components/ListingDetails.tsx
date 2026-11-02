"use client";
import { detailFieldsFor, detailFacts } from "@huambo-online/core";
import { useT } from "../lib/i18n";

/** Campos próprios de viaturas (marca, modelo, ano…) e imóveis (tipo, área, quartos…). */
export function DetailFields({ listingType, categorySlug, values, onChange }: { listingType: string; categorySlug?: string; values: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const { t } = useT();
  const fields = detailFieldsFor(listingType, categorySlug);
  if (!fields.length) return null;
  const set = (k: string, v: string) => onChange({ ...values, [k]: v });
  return <fieldset className="stack" style={{ border: "2px solid var(--line)", borderRadius: 12, padding: 14 }}>
    <legend style={{ fontWeight: 700 }}>{listingType === "vehicle" ? "🚗 " + t("attr.vehicle") : listingType === "real_estate" ? "🏠 " + t("attr.real_estate") : "📋 " + t("attr.details")}</legend>
    <div className="row">{fields.map(f => <label key={f.key} style={{ flex: "1 1 200px" }}>
      {t("attr." + f.key)}{f.unit ? ` (${t("attr.unit." + f.unit)})` : ""}{f.required ? " *" : ""}
      {f.kind === "select"
        ? <select value={values[f.key] ?? ""} onChange={e => set(f.key, e.target.value)}>
            <option value="">{t("ls.choose")}</option>
            {f.options!.map(o => <option key={o} value={o}>{t(`attr.${f.key}.${o}`)}</option>)}
          </select>
        : <input value={values[f.key] ?? ""} onChange={e => set(f.key, e.target.value)} required={f.required}
            inputMode={f.kind === "text" ? "text" : f.kind === "int" ? "numeric" : "decimal"} maxLength={f.kind === "text" ? 60 : 12} placeholder={t("attr.ph." + f.key)} />}
    </label>)}</div>
  </fieldset>;
}

/** Ficha técnica no anúncio: «Marca: Toyota · Ano: 2015 · 120 000 km». */
export function DetailFacts({ listingType, attributes, categorySlug }: { listingType: string; attributes: unknown; categorySlug?: string }) {
  const { t, lang } = useT();
  const facts = detailFacts(listingType, attributes, categorySlug);
  if (!facts.length) return null;
  const num = (v: string) => Number(v).toLocaleString(lang === "zh" ? "zh-CN" : lang === "en" ? "en-GB" : lang === "fr" ? "fr-FR" : "pt-PT");
  return <>{facts.map(f => <span key={f.key} style={{ display: "contents" }}>
    <dt>{t("attr." + f.key)}</dt>
    <dd>{f.option ? t(`attr.${f.key}.${f.value}`) : /^\d+(\.\d+)?$/.test(f.value) && f.key !== "year" ? num(f.value) : f.value}{f.unit ? " " + t("attr.unit." + f.unit) : ""}</dd>
  </span>)}</>;
}
