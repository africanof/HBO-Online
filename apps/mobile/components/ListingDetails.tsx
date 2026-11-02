import { Text, TextInput, View } from "react-native";
import { detailFieldsFor, detailFacts } from "@huambo-online/core";
import { useT } from "../lib/i18n";
import { C, ui } from "../lib/ui";
import { Chips } from "./Ui";

/** Campos próprios de viaturas (marca, modelo, ano…) e imóveis (tipo, área, quartos…). */
export function DetailFields({ listingType, categorySlug, values, onChange }: { listingType: string; categorySlug?: string; values: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const { t } = useT();
  const fields = detailFieldsFor(listingType, categorySlug);
  if (!fields.length) return null;
  const set = (k: string, v: string) => onChange({ ...values, [k]: v });
  return <View style={[ui.card, { gap: 8 }]}>
    <Text style={ui.h2}>{listingType === "vehicle" ? "🚗 " + t("attr.vehicle") : listingType === "real_estate" ? "🏠 " + t("attr.real_estate") : "📋 " + t("attr.details")}</Text>
    {fields.map(f => <View key={f.key} style={{ gap: 6 }}>
      <Text style={ui.label}>{t("attr." + f.key)}{f.unit ? ` (${t("attr.unit." + f.unit)})` : ""}{f.required ? " *" : ""}</Text>
      {f.kind === "select"
        ? <Chips options={f.options!.map(o => ({ value: o, label: t(`attr.${f.key}.${o}`) }))} value={values[f.key] ?? ""} onChange={v => set(f.key, values[f.key] === v ? "" : v)} />
        : <TextInput style={ui.input} value={values[f.key] ?? ""} onChangeText={v => set(f.key, v)} maxLength={f.kind === "text" ? 60 : 12}
            keyboardType={f.kind === "text" ? "default" : f.kind === "int" ? "number-pad" : "decimal-pad"} placeholder={t("attr.ph." + f.key)} placeholderTextColor={C.muted} accessibilityLabel={t("attr." + f.key)} />}
    </View>)}
  </View>;
}

/** Ficha técnica no anúncio: «Marca: Toyota», «Ano: 2015», «Quilómetros: 120 000 km». */
export function DetailFacts({ listingType, attributes, categorySlug }: { listingType: string; attributes: unknown; categorySlug?: string }) {
  const { t, lang } = useT();
  const facts = detailFacts(listingType, attributes, categorySlug);
  if (!facts.length) return null;
  const num = (v: string) => Number(v).toLocaleString(lang === "zh" ? "zh-CN" : lang === "en" ? "en-GB" : lang === "fr" ? "fr-FR" : "pt-PT");
  return <View style={[ui.card, { gap: 4 }]}>
    {facts.map(f => <Text key={f.key} style={ui.text}><Text style={ui.label}>{t("attr." + f.key)}: </Text>
      {f.option ? t(`attr.${f.key}.${f.value}`) : /^\d+(\.\d+)?$/.test(f.value) && f.key !== "year" ? num(f.value) : f.value}{f.unit ? " " + t("attr.unit." + f.unit) : ""}</Text>)}
  </View>;
}
