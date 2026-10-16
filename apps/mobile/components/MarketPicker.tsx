import { useEffect, useState } from "react";
import { Link } from "expo-router";
import { Text, View } from "react-native";
import { listMarketOptions, shortMarketName } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Chips } from "./Ui";
import { useT } from "../lib/i18n";

/** Campo "Vende numa praça? (opcional)" para anúncios, produtos e empresas. */
export function MarketPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useT();
  const [options, setOptions] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => { void listMarketOptions(supabase()).then(({ data }) => setOptions(data ?? [])); }, []);
  if (!options.length) return null;
  return <View style={{ gap: 8 }}>
    <Text style={ui.label}>{t("sh.market_q")}</Text>
    <Chips options={[{ value: "", label: t("sh.no") }, ...options.map(o => ({ value: o.id, label: shortMarketName(o.name) }))]} value={value} onChange={onChange} />
  </View>;
}

/** Linha "🧺 Praça do Kapango" com ligação (busca o nome pela id). */
export function MarketLink({ id }: { id?: string | null }) {
  const [name, setName] = useState("");
  useEffect(() => { if (!id) return; void supabase().from("markets").select("name").eq("id", id).maybeSingle().then(({ data }) => setName(data?.name ?? "")); }, [id]);
  if (!id || !name) return null;
  return <Link href={("/pracas/" + id) as any} style={ui.link}>🧺 {name} →</Link>;
}
