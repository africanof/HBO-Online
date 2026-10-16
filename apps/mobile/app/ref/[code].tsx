import { useEffect, useState } from "react";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text } from "react-native";
import { findByRef, parseRef, refHref, friendlyErrorIn, REF_LABELS } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";
import { ui } from "../../lib/ui";
import { useT } from "../../lib/i18n";

/** Abre um anúncio, produto ou encomenda pelo número (ex.: A-1001). */
export default function RefScreen() {
  const { code } = useLocalSearchParams<{ code: string }>(); const router = useRouter(); const { t, tc, lang } = useT();
  const ref = parseRef(decodeURIComponent(String(code ?? "")));
  const [msg, setMsg] = useState(ref ? t("ls.ref.searching") : "");
  useEffect(() => {
    if (!ref) return;
    void findByRef(supabase(), ref.code).then(r => {
      if (r.error) setMsg(friendlyErrorIn(r.error, lang));
      else if (r.data) router.replace((r.data.kind === "order" ? "/encomendas" : refHref(r.data.kind, r.data.id)) as any);
      else setMsg(t("ls.ref.not_found", { what: tc(REF_LABELS[ref.kind]).toLowerCase(), code: ref.code }) + (ref.kind === "order" ? " " + t("ls.ref.orders_hint") : ""));
    });
  }, [code]);
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/" style={ui.link}>← {t("nav.home")}</Link>
    <Text style={ui.h1}>{ref ? ref.code : t("ls.ref.invalid")}</Text>
    {ref ? <Text style={ui.text} accessibilityLiveRegion="polite">{msg}</Text> : <Text style={ui.text}>{t("ls.ref.format")}</Text>}
  </ScrollView>;
}
