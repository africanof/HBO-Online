"use client";
import { useEffect, useState } from "react";
import { listProviders, listBusinesses, getProvider, getBusiness, listProviderServices, listReviewsFor, submitReview, contactDirectoryOwner,
  listDirectoryCategories, listProvinces, listMunicipalities, ratingLabel, whatsappLink, formatPrice, friendlyError, type ReviewTarget } from "@huambo-online/core";
import { supabase } from "../lib/supabase";

type Kind = "providers" | "businesses";
type Option = { id: string; name: string };
const TEXT = {
  providers: { title: "Profissionais e serviços", search: "Ex.: eletricista, advogado, explicações…", empty: "Ainda não há profissionais registados nesta pesquisa.", base: "/profissionais", cta: "Sou profissional — criar perfil", ctaHref: "/conta/profissional" },
  businesses: { title: "Empresas e lojas", search: "Ex.: farmácia, oficina, restaurante…", empty: "Ainda não há empresas registadas nesta pesquisa.", base: "/empresas", cta: "Registar a minha empresa", ctaHref: "/conta/empresas" }
};

export function useTerritory() {
  const [provinces, setProvinces] = useState<Option[]>([]);
  const [municipalities, setMunicipalities] = useState<Option[]>([]);
  const [provinceId, setProvinceId] = useState("");
  useEffect(() => { void listProvinces(supabase()).then(({ data }) => { const l = (data ?? []) as Option[]; setProvinces(l); if (l.length === 1) setProvinceId(l[0].id); }); }, []);
  useEffect(() => { if (!provinceId) { setMunicipalities([]); return; } void listMunicipalities(supabase(), provinceId).then(({ data }) => setMunicipalities((data ?? []) as Option[])); }, [provinceId]);
  return { provinces, municipalities, provinceId, setProvinceId };
}

export function DirectoryList({ kind }: { kind: Kind }) {
  const t = TEXT[kind];
  const [q, setQ] = useState(""); const [categoryId, setCategoryId] = useState(""); const [municipalityId, setMunicipalityId] = useState("");
  const [categories, setCategories] = useState<Option[]>([]); const { municipalities } = useTerritory();
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");

  useEffect(() => { void listDirectoryCategories(supabase(), kind).then(({ data }) => setCategories(data ?? [])); void search(); }, []);
  async function search(e?: React.FormEvent) {
    e?.preventDefault(); setError("");
    const f = { query: q, categoryId, municipalityId };
    const r: any = kind === "providers" ? await listProviders(supabase(), f) : await listBusinesses(supabase(), f);
    if (r.error) setError(friendlyError(r.error)); else setItems(r.data ?? []);
  }

  return <main className="stack">
    <a href="/">← Huambo Online</a>
    <h1>{t.title}</h1>
    <a className="btn secondary" href={t.ctaHref} style={{ justifySelf: "start" }}>{t.cta}</a>
    <form onSubmit={search} className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))" }}>
      <label>Pesquisar<input value={q} onChange={e => setQ(e.target.value)} placeholder={t.search} /></label>
      <label>Categoria<select value={categoryId} onChange={e => setCategoryId(e.target.value)}><option value="">Todas</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Município<select value={municipalityId} onChange={e => setMunicipalityId(e.target.value)}><option value="">Todos</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <button type="submit" style={{ alignSelf: "end" }}>Pesquisar</button>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
    {items?.length === 0 && <p>{t.empty}</p>}
    <section className="grid">
      {items?.map(x => {
        const id = kind === "providers" ? x.user_id : x.id;
        const name = kind === "providers" ? x.display_name : x.name;
        return <a key={id} href={`${t.base}/${id}`} className="card" style={{ color: "inherit", textDecoration: "none" }}>
          <strong style={{ fontSize: 20 }}>{name}{x.verified ? " ✔️" : ""}</strong>
          {kind === "providers" ? x.headline && <span>{x.headline}</span> : x.description && <span>{String(x.description).slice(0, 120)}</span>}
          <span>{[x.category_name, x.municipality_name].filter(Boolean).join(" · ")}</span>
          <span>{ratingLabel(x.rating, x.review_count)}</span>
        </a>;
      })}
    </section>
  </main>;
}

export function DirectoryDetail({ kind, id }: { kind: Kind; id: string }) {
  const target: ReviewTarget = kind === "providers" ? { providerId: id } : { businessId: id };
  const [item, setItem] = useState<any>(null); const [services, setServices] = useState<any[]>([]); const [reviews, setReviews] = useState<any[]>([]);
  const [uid, setUid] = useState<string | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [message, setMessage] = useState(""); const [rating, setRating] = useState(0); const [comment, setComment] = useState(""); const [busy, setBusy] = useState(false);

  async function load() {
    const c = supabase();
    const r: any = kind === "providers" ? await getProvider(c, id) : await getBusiness(c, id);
    if (r.error) { setError(friendlyError(r.error)); return; }
    if (!r.data) { setError("Não encontrado."); return; }
    setItem(r.data);
    if (kind === "providers") { const s = await listProviderServices(c, id); setServices(s.data ?? []); }
    const rv = await listReviewsFor(c, target); setReviews((rv.data as any[]) ?? []);
    const u = await c.auth.getUser(); setUid(u.data.user?.id ?? null);
  }
  useEffect(() => { if (id) void load(); }, [id]);

  async function contact() {
    if (!uid) { setError("Inicie sessão para enviar mensagem."); return; }
    setBusy(true); setError("");
    const r = await contactDirectoryOwner(supabase(), target, message); setBusy(false);
    if (r.error) { setError(friendlyError(r.error)); return; }
    window.location.href = "/mensagens?conversation=" + (r.data as any)?.id;
  }
  async function review() {
    if (!uid) { setError("Inicie sessão para avaliar."); return; }
    setBusy(true); setError(""); setNotice("");
    const r = await submitReview(supabase(), target, rating, comment); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setNotice("Obrigado pela sua avaliação."); setComment(""); await load(); }
  }

  if (error && !item) return <main><a href={TEXT[kind].base}>← Voltar</a><p className="error">{error}</p></main>;
  if (!item) return <main><p>A carregar…</p></main>;
  const ownerId = kind === "providers" ? item.user_id : item.owner_id;
  const mine = uid === ownerId;
  const name = kind === "providers" ? item.display_name : item.name;
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const wa = whatsappLink(item.whatsapp, "Olá, vi o seu perfil no Huambo Online.");

  return <main className="stack">
    <a href={TEXT[kind].base}>← Voltar</a>
    <h1>{name}{item.verified ? " ✔️" : ""}</h1>
    {kind === "providers" && item.headline && <p style={{ fontSize: 19 }}>{item.headline}</p>}
    <p>{[item.categories?.name, item.municipalities?.name, item.address_text].filter(Boolean).join(" · ")}</p>
    <p><strong>{ratingLabel(avg, reviews.length)}</strong></p>
    {(item.bio || item.description) && <p style={{ whiteSpace: "pre-wrap" }}>{item.bio || item.description}</p>}
    <div className="row">
      {item.phone && <a className="btn secondary" href={"tel:" + item.phone.replace(/\s/g, "")}>📞 Ligar</a>}
      {wa && <a className="btn secondary" href={wa} target="_blank" rel="noopener">WhatsApp</a>}
      {mine && <a className="btn" href={kind === "providers" ? "/conta/profissional" : "/conta/empresas"}>Editar</a>}
    </div>
    {kind === "providers" && services.length > 0 && <section className="stack"><h2>Serviços</h2>
      {services.map(s => <div key={s.id} className="card"><strong>{s.title}</strong>{s.description && <span>{s.description}</span>}<span>{s.price_from != null ? "Desde " + formatPrice(s.price_from, s.currency) : "Preço sob consulta"}</span></div>)}
    </section>}
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {!mine && <section className="card"><h2 style={{ margin: 0 }}>Enviar mensagem</h2>
      <textarea rows={4} value={message} onChange={e => setMessage(e.target.value)} placeholder="Olá, gostaria de pedir um orçamento…" />
      <button disabled={busy || !message.trim()} onClick={contact}>{busy ? "A enviar…" : "Enviar mensagem"}</button>
    </section>}
    <section className="stack"><h2>Avaliações</h2>
      {!mine && <div className="card">
        <div className="row" role="radiogroup" aria-label="Estrelas">{[1, 2, 3, 4, 5].map(n => <button key={n} type="button" className={n <= rating ? "" : "secondary"} aria-label={`${n} estrela(s)`} onClick={() => setRating(n)}>★</button>)}</div>
        <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} placeholder="Como foi a sua experiência?" />
        <button disabled={busy || !rating} onClick={review}>Publicar avaliação</button>
      </div>}
      {reviews.length === 0 && <p>Ainda sem avaliações.</p>}
      {reviews.map(r => <div key={r.id} className="card"><strong>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)} — {r.author_name}</strong>{r.comment && <span>{r.comment}</span>}<small>{new Date(r.created_at).toLocaleDateString("pt-AO")}</small></div>)}
    </section>
  </main>;
}
