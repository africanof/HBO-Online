import { useEffect, useState } from "react";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text } from "react-native";
import { findByRef, parseRef, refHref, friendlyError, REF_LABELS } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";
import { ui } from "../../lib/ui";

/** Abre um anúncio, produto ou encomenda pelo número (ex.: A-1001). */
export default function RefScreen() {
  const { code } = useLocalSearchParams<{ code: string }>(); const router = useRouter();
  const ref = parseRef(decodeURIComponent(String(code ?? "")));
  const [msg, setMsg] = useState(ref ? "A procurar…" : "");
  useEffect(() => {
    if (!ref) return;
    void findByRef(supabase(), ref.code).then(r => {
      if (r.error) setMsg(friendlyError(r.error));
      else if (r.data) router.replace((r.data.kind === "order" ? "/encomendas" : refHref(r.data.kind, r.data.id)) as any);
      else setMsg(`Não encontrámos ${REF_LABELS[ref.kind].toLowerCase()} com o número ${ref.code}.` + (ref.kind === "order" ? " As encomendas só aparecem a quem comprou ou vendeu (entre na sua conta)." : ""));
    });
  }, [code]);
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/" style={ui.link}>← Início</Link>
    <Text style={ui.h1}>{ref ? ref.code : "Número inválido"}</Text>
    {ref ? <Text style={ui.text} accessibilityLiveRegion="polite">{msg}</Text> : <Text style={ui.text}>Os números são assim: A-1001 (anúncio), P-1001 (produto) ou E-1001 (encomenda).</Text>}
  </ScrollView>;
}
