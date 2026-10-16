"use client";
import { useEffect, useState } from "react";
import { listMarketOptions } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT } from "../lib/i18n";

/** Campo "Praça (opcional)" para anúncios, produtos e empresas. */
export function MarketPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useT();
  const [options, setOptions] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => { void listMarketOptions(supabase()).then(({ data }) => setOptions(data ?? [])); }, []);
  return <label>{t("sh.mkp.question")}
    <select value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{t("sh.mkp.none")}</option>
      {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  </label>;
}

/** Linha "Praça: Praça do Kapango →" (busca o nome pela id). */
export function MarketFact({ id }: { id?: string | null }) {
  const { t } = useT();
  const [name, setName] = useState("");
  useEffect(() => { if (!id) return; void supabase().from("markets").select("name").eq("id", id).maybeSingle().then(({ data }) => setName(data?.name ?? "")); }, [id]);
  if (!id || !name) return null;
  return <><dt>{t("sh.market")}</dt><dd>🧺 <a href={"/pracas/" + id}>{name}</a></dd></>;
}
