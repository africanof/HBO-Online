"use client";
import { useEffect, useState } from "react";
import { getDeliveryPolicy, deliveryPolicyLines, type DeliveryPolicy } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT } from "../lib/i18n";

/**
 * 🚚 Peças das regras de entrega dos vendedores (iguais na APP): caixa «Entrega e levantamento» nas páginas do produto,
 * do anúncio e do vendedor, e a escolha província → município.
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
  return <section className="card delivery-box" aria-labelledby={"dl-box-" + sellerId}>
    <h2 id={"dl-box-" + sellerId} style={{ margin: 0, fontSize: 20 }}>{t("sh.dl.box_title")}</h2>
    <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 4 }}>
      {deliveryPolicyLines(policy).map((line, i) => <li key={i}>{tc(line)}</li>)}
    </ul>
  </section>;
}

type Option = { id: string; name: string };
/** Província → município (as mesmas listas dos formulários do Site). */
export function MunicipalitySelect({ provinces, municipalities, provinceId, setProvinceId, value, onChange, label, exclude = [], idPrefix }: {
  provinces: Option[]; municipalities: Option[]; provinceId: string; setProvinceId: (v: string) => void;
  value: string; onChange: (id: string, name: string) => void; label?: string; exclude?: string[]; idPrefix: string;
}) {
  const { t } = useT();
  const list = municipalities.filter(m => !exclude.includes(m.id) || m.id === value);
  return <div className="dl-pick">
    <label htmlFor={idPrefix + "-prov"}>{t("ls.province")}
      <select id={idPrefix + "-prov"} value={provinceId} onChange={e => { setProvinceId(e.target.value); onChange("", ""); }}>
        <option value="">{t("ls.choose_province")}</option>
        {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
    <label htmlFor={idPrefix + "-mun"}>{label ?? t("auth.municipality")}
      <select id={idPrefix + "-mun"} value={value} disabled={!provinceId} onChange={e => onChange(e.target.value, municipalities.find(m => m.id === e.target.value)?.name ?? "")}>
        <option value="">{t("ls.choose_municipality")}</option>
        {list.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
    </label>
  </div>;
}
