"use client";
import { useEffect, useState } from "react";
import { listMyBusinesses, saveBusiness, deleteBusiness, listDirectoryCategories, friendlyError } from "@huambo-online/core";
import { supabase, currentUserId } from "../../../lib/supabase";
import { useTerritory } from "../../../components/Directory";

type Option = { id: string; name: string };
const empty = { name: "", description: "", categoryId: "", municipalityId: "", phone: "", whatsapp: "", addressText: "", active: true };

export default function MinhasEmpresas() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<any[]>([]); const [form, setForm] = useState(empty); const [editing, setEditing] = useState<string | null>(null);
  const [categories, setCategories] = useState<Option[]>([]); const { provinces, municipalities, provinceId, setProvinceId } = useTerritory();
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);

  async function load(id: string) { const r = await listMyBusinesses(supabase(), id); setItems(r.data ?? []); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(id); }); void listDirectoryCategories(supabase(), "businesses").then(({ data }) => setCategories(data ?? [])); }, []);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!uid) return;
    setBusy(true); setError(""); setNotice("");
    const r = await saveBusiness(supabase(), uid, form, editing ?? undefined); setBusy(false);
    if (r.error) { setError(friendlyError(r.error)); return; }
    setNotice(editing ? "Empresa atualizada." : "Empresa registada."); setForm(empty); setEditing(null); await load(uid);
  }

  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main><a href="/empresas">← Empresas</a><h1>As minhas empresas</h1><p>Para registar a sua empresa, <a href="/conta/login?voltar=/conta/empresas">inicie sessão</a>.</p></main>;

  return <main className="stack" style={{ maxWidth: 720 }}>
    <a href="/conta">← Conta</a>
    <h1>As minhas empresas</h1>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items.map(b => <div key={b.id} className="card">
      <strong>{b.name}{b.verified ? " ✔️" : ""}{b.active ? "" : " (oculta)"}</strong>
      <div className="row">
        <a className="btn secondary" href={"/empresas/" + b.id}>Ver</a>
        <button className="secondary" onClick={() => { setEditing(b.id); setForm({ name: b.name ?? "", description: b.description ?? "", categoryId: b.category_id ?? "", municipalityId: b.municipality_id ?? "", phone: b.phone ?? "", whatsapp: b.whatsapp ?? "", addressText: b.address_text ?? "", active: b.active }); window.scrollTo(0, document.body.scrollHeight); }}>Editar</button>
        <button className="danger" onClick={async () => { if (!confirm("Apagar esta empresa?")) return; const r = await deleteBusiness(supabase(), b.id); if (r.error) setError(friendlyError(r.error)); else await load(uid); }}>Apagar</button>
      </div>
    </div>)}
    <form className="stack card" onSubmit={submit}>
      <h2 style={{ margin: 0 }}>{editing ? "Editar empresa" : "Registar empresa"}</h2>
      <label>Nome<input value={form.name} onChange={set("name")} /></label>
      <label>Descrição<textarea rows={4} value={form.description} onChange={set("description")} placeholder="O que vende ou faz, horário…" /></label>
      <label>Categoria<select value={form.categoryId} onChange={set("categoryId")}><option value="">Escolha</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Província<select value={provinceId} onChange={e => { setProvinceId(e.target.value); setForm({ ...form, municipalityId: "" }); }}><option value="">Escolha</option>{provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Município<select value={form.municipalityId} onChange={set("municipalityId")}><option value="">Escolha</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label>Morada / referência<input value={form.addressText} onChange={set("addressText")} placeholder="Ex.: Rua X, perto do mercado" /></label>
      <label>Telefone<input type="tel" value={form.phone} onChange={set("phone")} /></label>
      <label>WhatsApp<input type="tel" value={form.whatsapp} onChange={set("whatsapp")} /></label>
      <label style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} style={{ width: 24, height: 24 }} /> Visível ao público</label>
      <div className="row"><button disabled={busy}>{editing ? "Guardar" : "Registar empresa"}</button>{editing && <button type="button" className="secondary" onClick={() => { setEditing(null); setForm(empty); }}>Cancelar</button>}</div>
    </form>
  </main>;
}
