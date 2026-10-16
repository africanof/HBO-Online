"use client";
import { useEffect, useState } from "react";
import { findHelpers, ratingLabel } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { LiteImg } from "./LiteImg";
import { useT } from "../lib/i18n";

/** «Profissionais e empresas que podem ajudar» num pedido «Procura-se». */
export function WantedHelpers({ title, mine }: { title: string; mine: boolean }) {
  const { t, tc } = useT();
  const [h, setH] = useState<{ providers: any[]; businesses: any[] } | null>(null);
  useEffect(() => { void findHelpers(supabase(), title, 8).then(setH); }, [title]);
  if (!h || (!h.providers.length && !h.businesses.length)) return null;
  return <section className="stack">
    <h2 style={{ margin: 0 }}>🛠️ {mine ? t("ls.helpers_title") : t("ls.helpers_also")}</h2>
    {mine && <p className="muted" style={{ margin: 0 }}>{t("ls.helpers_notified")}</p>}
    <div className="shelf">
      {h.providers.map(p => <a key={p.user_id} href={"/profissionais/" + p.user_id} className="card" style={{ color: "inherit", textDecoration: "none", fontWeight: 400 }}>
        {p.avatar_url ? <LiteImg placeholder="👤" src={p.avatar_url} alt="" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }} /> : <span aria-hidden style={{ fontSize: 36 }}>👷</span>}
        <strong>{p.display_name}{p.verified ? " ✔️" : ""}</strong>
        <span className="item-meta">{[p.category_name, p.municipality_name].filter(Boolean).join(" · ")}</span>
        <span className="item-meta">{tc(ratingLabel(p.rating, p.review_count))}</span>
      </a>)}
      {h.businesses.map(b => <a key={b.id} href={"/empresas/" + b.id} className="card" style={{ color: "inherit", textDecoration: "none", fontWeight: 400 }}>
        <span aria-hidden style={{ fontSize: 36 }}>🏢</span>
        <strong>{b.name}{b.verified ? " ✔️" : ""}</strong>
        <span className="item-meta">{[b.category_name, b.municipality_name].filter(Boolean).join(" · ")}</span>
        <span className="item-meta">{tc(ratingLabel(b.rating, b.review_count))}</span>
      </a>)}
    </div>
  </section>;
}
