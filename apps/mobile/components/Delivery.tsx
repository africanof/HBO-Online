import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { getDeliveryPolicy, deliveryPolicyLines, type DeliveryPolicy } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui, C } from "../lib/ui";
import { Chips } from "./Ui";
import { useT } from "../lib/i18n";

/**
 * 🚚 Peças das regras de entrega dos vendedores (iguais no Site): caixa «Entrega e levantamento» nas páginas do produto,
 * do anúncio e do vendedor, escolha da província → município e os botões grandes «Levantamento» / «Entrega» do carrinho.
 */

/** Caixa «🚚 Entrega e levantamento» de um vendedor. Se der erro (ou sem rede), não aparece. */
export function DeliveryPolicyBox({ sellerId }: { sellerId?: string | null }) {
  const { t, tc } = useT();
  const [policy, setPolicy] = useState<DeliveryPolicy | null | undefined>(undefined);
  useEffect(() => {
    if (!sellerId) return;
    let alive = true;
    void getDeliveryPolicy(supabase(), sellerId).then(r => { if (alive) setPolicy(r.error ? undefined : r.data); }).catch(() => {});
    return () => { alive = false; };
  }, [sellerId]);
  if (!sellerId || policy === undefined) return null;
  return <View style={ui.card} accessibilityLabel={t("sh.dl.box_title")}>
    <Text style={ui.h2}>{t("sh.dl.box_title")}</Text>
    {deliveryPolicyLines(policy).map((line, i) => <Text key={i} style={ui.text}>{tc(line)}</Text>)}
  </View>;
}

type Option = { id: string; name: string };
/** Província → município (os mesmos botões dos formulários). */
export function MunicipalityChooser({ provinces, municipalities, provinceId, setProvinceId, value, onChange, exclude = [] }: {
  provinces: Option[]; municipalities: Option[]; provinceId: string; setProvinceId: (v: string) => void;
  value: string; onChange: (id: string, name: string) => void; exclude?: string[];
}) {
  const { t } = useT();
  const list = municipalities.filter(m => !exclude.includes(m.id));
  return <View style={{ gap: 8 }}>
    {provinces.length > 1 && <><Text style={ui.label}>{t("sh.province")}</Text>
      <Chips options={provinces.map(p => ({ value: p.id, label: p.name }))} value={provinceId} onChange={v => { setProvinceId(v); onChange("", ""); }} /></>}
    <Text style={ui.label}>{t("auth.municipality")}</Text>
    {!provinceId ? <Text style={ui.muted}>{t("ls.form.province_first")}</Text>
      : <Chips options={list.map(m => ({ value: m.id, label: m.name }))} value={value} onChange={id => onChange(id, municipalities.find(m => m.id === id)?.name ?? "")} />}
  </View>;
}

/** Botão grande de escolha (fica cinzento quando a opção não existe para este vendedor). */
export function ChoiceButton({ label, on, disabled, onPress }: { label: string; on: boolean; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: on, disabled: !!disabled }} disabled={disabled} onPress={onPress}
    style={{ flexGrow: 1, flexBasis: 140, minHeight: 56, borderRadius: 14, borderWidth: 2, alignItems: "center", justifyContent: "center", paddingHorizontal: 12,
      borderColor: on ? C.ink : C.line, backgroundColor: on ? C.ink : C.surface, opacity: disabled ? 0.45 : 1 }}>
    <Text style={{ fontSize: 17, fontWeight: "800", color: on ? C.white : C.ink, textAlign: "center" }}>{label}</Text>
  </Pressable>;
}
