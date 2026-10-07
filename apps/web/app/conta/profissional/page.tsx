"use client";
import { useEffect, useState } from "react";
import { getProvider, saveMyProviderProfile, listProviderServices, saveService, deleteService, listDirectoryCategories, friendlyError, parsePrice, formatPrice } from "@huambo-online/core";
import { supabase, currentUserId } from "../../../lib/supabase";
import { useTerritory } from "../../../components/Directory";

type Option = { id: string; name: string };
const empty = { displayName: "", headline: "", bio: "", categoryId: "", municipalityId: "", phone: "", whatsapp: "", active: true };

export default function PerfilProfissional() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [form, setForm] = useState(empty); const [exists, setExists] = useState(false);
  const [services, setServices] = useState<any[]>([]); const [svc, setSvc] = useState({ title: "", description: "", price: "" });
  const [categories, setCategories] = useState<Option[]>([]); const { provinces, municipalities, provinceId, setProvinceId } = useTerritory();
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);

  async function load(id: string) {
    const c = supabase();
    const p = await getProvider(c, id);
    if (p.data) { setExists(true); setForm({ displayName: p.data.display_name ?? "", headline: p.data.headline ?? "", bio: p.data.bio ?? "", categoryId: p.data.category_id ?? "", municipalityId: p.data.municipality_id ?? "", phone: p.data.phone ?? "", whatsapp: p.data.whatsapp ?? "", active: p.data.active }); }
    const s = await listProviderServices(c, id, true); setServices(s.data ?? []);
  }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(id); }); void listDirectoryCategories(supabase(), "providers").then(({ data }) => setCategories(data ?? [])); }, []);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  async function run(fn: () => PromiseLike<{ error: any }>, ok: string) {
    setBusy(true); setError(""); setNotice("");
    const r = await fn(); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(ok); if (uid) await load(uid); }
    return !r.error;
  }

  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main><a href="/profissionais">← Profissionais</a><h1>Perfil profissional</h1><p>Para criar o seu perfil, <a href="/conta/login?voltar=/conta/profissional">inicie sessão</a>.</p></main>;

  return <main className="stack" style={{ maxWidth: 720 }}>
    <a href="/conta">← Conta</a>
    <h1>{exists ? "O meu perfil profissional" : "Criar perfil profissional"}</h1>
    <p>Apareça na lista de profissionais do Huambo Online e receba pedidos de clientes.</p>
    {exists && <a href={"/profissionais/" + uid}>Ver o meu perfil público →</a>}
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <form className="stack card" onSubmit={e => { e.preventDefault(); void run(() => saveMyProviderProfile(supabase(), uid, form), "Perfil guardado."); }}>
      <label>Nome profissional<input value={form.displayName} onChange={set("displayName")} placeholder="Ex.: João Eletricista" /></label>
      <label>Resumo<input value={form.headline} onChange={set("headline")} placeholder="Ex.: Instalações elétricas e reparações" /></label>
      <label>Sobre si<textarea rows={4} value={form.bio} onChange={set("bio")} placeholder="Experiência, horário, zonas onde trabalha…" /></label>
      <label>Área de atividade<select value={form.categoryId} onChange={set("categoryId")}><option value="">Escolha</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Província<select value={provinceId} onChange={e => { setProvinceId(e.target.value); setForm({ ...form, municipalityId: "" }); }}><option value="">Escolha</option>{provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Município<select value={form.municipalityId} onChange={set("municipalityId")}><option value="">Escolha</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label>Telefone<input type="tel" value={form.phone} onChange={set("phone")} placeholder="923 000 000" /></label>
      <label>WhatsApp<input type="tel" value={form.whatsapp} onChange={set("whatsapp")} placeholder="923 000 000" /></label>
      <label style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} style={{ width: 24, height: 24 }} /> Perfil visível ao público</label>
      <button disabled={busy}>{exists ? "Guardar perfil" : "Criar perfil"}</button>
    </form>
    {exists && <section className="stack">
      <h2>Os meus serviços</h2>
      <form className="stack card" onSubmit={e => { e.preventDefault(); void run(() => saveService(supabase(), uid, { title: svc.title, description: svc.description, priceFrom: parsePrice(svc.price), categoryId: form.categoryId }), "Serviço adicionado.").then(ok => { if (ok) setSvc({ title: "", description: "", price: "" }); }); }}>
        <label>Serviço<input value={svc.title} onChange={e => setSvc({ ...svc, title: e.target.value })} placeholder="Ex.: Instalação de tomadas" /></label>
        <label>Descrição<input value={svc.description} onChange={e => setSvc({ ...svc, description: e.target.value })} /></label>
        <label>Preço desde (Kz)<input value={svc.price} inputMode="decimal" onChange={e => setSvc({ ...svc, price: e.target.value })} placeholder="Vazio = sob consulta" /></label>
        <button disabled={busy}>Adicionar serviço</button>
      </form>
      {services.map(s => <div key={s.id} className="card row" style={{ justifyContent: "space-between" }}>
        <span><strong>{s.title}</strong> · {s.price_from != null ? "desde " + formatPrice(s.price_from, s.currency) : "sob consulta"}</span>
        <button className="danger" onClick={() => { if (confirm("Apagar este serviço?")) void run(() => deleteService(supabase(), s.id), "Serviço apagado."); }}>Apagar</button>
      </div>)}
    </section>}
  </main>;
}
