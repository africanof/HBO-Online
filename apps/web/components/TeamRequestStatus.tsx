"use client";
import { useEffect, useState } from "react";
import { listMyTeamRequestStates, teamRequestTarget, formatPrice, type MyTeamRequestState } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT, formatDateIn } from "../lib/i18n";

/** Pedidos do cliente e a equipa do Huambo Online: à espera, aprovados ou recusados. */
export function TeamRequestStatus() {
  const { lang, t } = useT();
  const [items, setItems] = useState<MyTeamRequestState[]>([]);
  useEffect(() => { void listMyTeamRequestStates(supabase()).then(r => setItems(r.data)); }, []);
  if (!items.length) return null;
  return <section className="card stack" style={{ gap: 6 }} aria-label={t("trs.title")}>
    <h2 style={{ margin: 0 }}>🛡️ {t("trs.title")}</h2>
    <p style={{ margin: 0 }}>{t("trs.intro")}</p>
    {items.map(r => <div key={r.kind + r.id} style={{ borderTop: "1px solid var(--line, #ddd)", paddingTop: 6 }}>
      <strong>{t("ad.req.kind." + r.kind)}</strong>{teamRequestTarget(r.title) ? " · " + teamRequestTarget(r.title) : ""}{r.ref_no ? ` · #${r.ref_no}` : ""}
      {r.amount != null && <> · {formatPrice(r.amount)}</>}
      <div><small>{formatDateIn(r.created_at, lang)} · {r.state === "pending" ? "⏳ " + t("trs.pending") : r.state === "approved" ? "✅ " + t("trs.approved") : "❌ " + t("trs.declined")}</small></div>
      {r.state === "declined" && r.team_note && <small>{t("trs.reason")}: {r.team_note}</small>}
    </div>)}
  </section>;
}
