"use client";
import { useEffect, useState } from "react";
import { listMySaved, toggleSaved, itemHref, friendlyErrorIn, SAVED_KIND_LABELS, type SavedKind } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { LiteImg } from "../../components/LiteImg";
import { useT } from "../../lib/i18n";

export default function Guardados() {
  const { lang, t, tc } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<any[]>([]); const [kind, setKind] = useState<SavedKind | "">(""); const [error, setError] = useState("");
  async function load() { const r = await listMySaved(supabase()); if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems((r.data as any[]) ?? []); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []);
  async function remove(x: any) { if (!uid) return; const r = await toggleSaved(supabase(), uid, x.kind, x.target_id, x.id); if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems(a => a.filter(i => i.id !== x.id)); }
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main><a href="/">← Huambo Online</a><h1>{t("nav.saved")}</h1><p><a href="/conta/login?voltar=/guardados">{t("ls.sign_in")}</a> {t("ls.to_see_favourites")}</p></main>;
  const shown = items.filter(x => !kind || x.kind === kind);
  return <main className="stack">
    <a href="/">← Huambo Online</a>
    <h1>{t("nav.saved")}</h1>
    <div className="row" role="tablist">
      <button role="tab" aria-selected={kind === ""} className={kind === "" ? "" : "secondary"} onClick={() => setKind("")}>{t("ls.all")}</button>
      {(Object.keys(SAVED_KIND_LABELS) as SavedKind[]).map(k => <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? "" : "secondary"} onClick={() => setKind(k)}>{tc(SAVED_KIND_LABELS[k])}</button>)}
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {shown.length === 0 && <p>{t("ls.saved_empty")}</p>}
    <section className="grid">{shown.map(x => <article key={x.id} className="card">
      {x.image ? <LiteImg className="thumb" src={x.image} alt="" /> : null}
      <small>{tc(SAVED_KIND_LABELS[x.kind as SavedKind] ?? "")}</small>
      <strong style={{ fontSize: 19 }}>{x.title}</strong>
      {x.subtitle && <span>{x.subtitle}</span>}
      <div className="row"><a className="btn secondary" href={itemHref(x.kind, x.target_id)}>{t("ls.open")}</a><button className="secondary" onClick={() => remove(x)}>{t("ls.remove")}</button></div>
    </article>)}</section>
  </main>;
}
