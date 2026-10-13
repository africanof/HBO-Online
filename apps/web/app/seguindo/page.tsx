"use client";
import { useEffect, useState } from "react";
import { listMyFollows, toggleFollow, followHref, friendlyError, FOLLOW_KIND_LABELS, type MyFollow } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { LiteImg } from "../../components/LiteImg";

export default function Seguindo() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<MyFollow[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listMyFollows(supabase()); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []);
  async function stop(f: MyFollow) {
    const r = await toggleFollow(supabase(), f.kind, f.id);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(`Deixou de seguir «${f.name}».`); await load(); }
  }
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main><h1>A seguir</h1><p><a href="/conta/login?voltar=/seguindo">Inicie sessão</a> para ver quem segue.</p></main>;
  return <main className="stack" style={{ maxWidth: 760 }}>
    <a href="/conta">← A sua conta</a>
    <h1>👥 A seguir</h1>
    <p style={{ margin: 0 }}>Recebe um aviso quando estes profissionais, empresas e lojas publicam algo novo.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items.length === 0 && <p>Ainda não segue ninguém. Abra a página de um <a href="/profissionais">profissional</a>, de uma <a href="/empresas">empresa</a> ou de um vendedor e carregue em «➕ Seguir».</p>}
    {items.map(f => <article key={f.kind + f.id} className="card">
      <div className="row" style={{ alignItems: "center", flexWrap: "nowrap" }}>
        {f.picture ? <LiteImg src={f.picture} alt="" placeholder={f.kind === "business" ? "🏪" : "👤"} style={{ width: 56, height: 56, borderRadius: f.kind === "business" ? 12 : "50%", objectFit: "cover", flex: "none" }} />
          : <span aria-hidden style={{ fontSize: 40 }}>{f.kind === "business" ? "🏪" : f.kind === "provider" ? "🧰" : "👤"}</span>}
        <span style={{ minWidth: 0 }}><a href={followHref(f.kind, f.id)}><strong style={{ overflowWrap: "anywhere" }}>{f.name}</strong></a><br /><small className="muted">{FOLLOW_KIND_LABELS[f.kind]}{f.detail ? " · " + f.detail : ""}</small></span>
      </div>
      <div className="row"><a className="btn secondary" href={followHref(f.kind, f.id)}>Ver</a><button className="secondary" onClick={() => stop(f)}>Deixar de seguir</button></div>
    </article>)}
  </main>;
}
