"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { findByRef, parseRef, refHref, friendlyErrorIn, REF_LABELS } from "@huambo-online/core";
import { supabase } from "../../../lib/supabase";
import { useT } from "../../../lib/i18n";

/** Abre um anúncio, produto ou encomenda pelo número (ex.: A-1001). */
export default function RefPage() {
  const { code } = useParams<{ code: string }>(); const router = useRouter();
  const { lang, t, tc } = useT();
  const ref = parseRef(decodeURIComponent(code ?? ""));
  const [msg, setMsg] = useState(ref ? t("ls.looking") : "");
  useEffect(() => {
    if (!ref) return;
    void findByRef(supabase(), ref.code).then(r => {
      if (r.error) setMsg(friendlyErrorIn(r.error, lang));
      else if (r.data) router.replace(refHref(r.data.kind, r.data.id));
      else setMsg(t("ls.ref_not_found", { what: tc(REF_LABELS[ref.kind]).toLowerCase(), code: ref.code }) + (ref.kind === "order" ? " " + t("ls.ref_orders_note") : ""));
    });
  }, [code]);
  return <main className="stack">
    <a href="/">← {t("nav.home")}</a>
    <h1>{ref ? ref.code : t("ls.ref_invalid")}</h1>
    {ref ? <p role="status">{msg}</p> : <p>{t("ls.ref_format")} <strong>A-1001</strong> ({t("ls.ref_listing")}), <strong>P-1001</strong> ({t("ls.ref_product")}) {t("ls.or")} <strong>E-1001</strong> ({t("ls.ref_order")}).</p>}
  </main>;
}
