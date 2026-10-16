"use client";
import { useEffect, useState } from "react";
import { listMyFollows, toggleFollow, followHref, friendlyErrorIn, FOLLOW_KIND_LABELS, type MyFollow } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { LiteImg } from "../../components/LiteImg";
import { useT } from "../../lib/i18n";

export default function Seguindo() {
  const { lang, t, tc } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<MyFollow[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listMyFollows(supabase()); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []);
  async function stop(f: MyFollow) {
    const r = await toggleFollow(supabase(), f.kind, f.id);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("ls.unfollowed", { name: f.name })); await load(); }
  }
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main><h1>{t("acct.l.following")}</h1><p><a href="/conta/login?voltar=/seguindo">{t("ls.sign_in")}</a> {t("ls.to_see_following")}</p></main>;
  return <main className="stack" style={{ maxWidth: 760 }}>
    <a href="/conta">← {t("acct.yours")}</a>
    <h1>👥 {t("acct.l.following")}</h1>
    <p style={{ margin: 0 }}>{t("ls.following_intro")}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items.length === 0 && <p>{t("ls.following_empty_a")} <a href="/profissionais">{t("ls.a_professional")}</a>, <a href="/empresas">{t("ls.a_business")}</a> {t("ls.following_empty_b")}</p>}
    {items.map(f => <article key={f.kind + f.id} className="card">
      <div className="row" style={{ alignItems: "center", flexWrap: "nowrap" }}>
        {f.picture ? <LiteImg src={f.picture} alt="" placeholder={f.kind === "business" ? "🏪" : "👤"} style={{ width: 56, height: 56, borderRadius: f.kind === "business" ? 12 : "50%", objectFit: "cover", flex: "none" }} />
          : <span aria-hidden style={{ fontSize: 40 }}>{f.kind === "business" ? "🏪" : f.kind === "provider" ? "🧰" : "👤"}</span>}
        <span style={{ minWidth: 0 }}><a href={followHref(f.kind, f.id)}><strong style={{ overflowWrap: "anywhere" }}>{f.name}</strong></a><br /><small className="muted">{tc(FOLLOW_KIND_LABELS[f.kind])}{f.detail ? " · " + tc(f.detail) : ""}</small></span>
      </div>
      <div className="row"><a className="btn secondary" href={followHref(f.kind, f.id)}>{t("ls.view")}</a><button className="secondary" onClick={() => stop(f)}>{t("ls.unfollow")}</button></div>
    </article>)}
  </main>;
}
