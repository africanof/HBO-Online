"use client";
import { useEffect, useState } from "react";
import { listMarketOptions } from "@huambo-online/core";
import { supabase } from "../lib/supabase";

/** Campo "Praça (opcional)" para anúncios, produtos e empresas. */
export function MarketPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [options, setOptions] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => { void listMarketOptions(supabase()).then(({ data }) => setOptions(data ?? [])); }, []);
  return <label>Vende numa praça? (opcional)
    <select value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Não / não se aplica</option>
      {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  </label>;
}

/** Linha "Praça: Praça do Kapango →" (busca o nome pela id). */
export function MarketFact({ id }: { id?: string | null }) {
  const [name, setName] = useState("");
  useEffect(() => { if (!id) return; void supabase().from("markets").select("name").eq("id", id).maybeSingle().then(({ data }) => setName(data?.name ?? "")); }, [id]);
  if (!id || !name) return null;
  return <><dt>Praça</dt><dd>🧺 <a href={"/pracas/" + id}>{name}</a></dd></>;
}
