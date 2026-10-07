import { useEffect, useState } from "react";
import { Link, useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { listProviders, listBusinesses, getProvider, getBusiness, listProviderServices, listReviewsFor, submitReview, contactDirectoryOwner,
  listDirectoryCategories, listProvinces, listMunicipalities, ratingLabel, whatsappLink, formatPrice, friendlyError, type ReviewTarget } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";

type Kind = "providers" | "businesses";
type Option = { id: string; name: string };
const TEXT = {
  providers: { title: "Profissionais e serviços", search: "Ex.: eletricista, advogado…", empty: "Ainda não há profissionais registados nesta pesquisa.", base: "/profissionais", cta: "Sou profissional — criar perfil", ctaHref: "/conta/profissional" },
  businesses: { title: "Empresas e lojas", search: "Ex.: farmácia, oficina…", empty: "Ainda não há empresas registadas nesta pesquisa.", base: "/empresas", cta: "Registar a minha empresa", ctaHref: "/conta/empresas" }
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
  const router = useRouter();
  const [q, setQ] = useState(""); const [categoryId, setCategoryId] = useState(""); const [municipalityId, setMunicipalityId] = useState(""); const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<Option[]>([]); const { municipalities } = useTerritory();
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");

  useEffect(() => { void listDirectoryCategories(supabase(), kind).then(({ data }) => setCategories(data ?? [])); void search(); }, []);
  async function search() {
    setError("");
    const f = { query: q, categoryId, municipalityId };
    const r: any = kind === "providers" ? await listProviders(supabase(), f) : await listBusinesses(supabase(), f);
    if (r.error) setError(friendlyError(r.error)); else setItems(r.data ?? []);
  }

  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/" style={ui.link}>← Huambo Online</Link>
    <Text style={ui.h1}>{t.title}</Text>
    <Button title={t.cta} variant="secondary" onPress={() => router.push(t.ctaHref as any)} />
    <TextInput value={q} onChangeText={setQ} placeholder={t.search} style={ui.input} returnKeyType="search" onSubmitEditing={() => void search()} />
    <Button title={showFilters ? "Esconder filtros" : "Filtros"} variant="secondary" onPress={() => setShowFilters(!showFilters)} />
    {showFilters && <View style={{ gap: 10 }}>
      <Text style={ui.label}>Categoria</Text>
      <Chips options={[{ value: "", label: "Todas" }, ...categories.map(c => ({ value: c.id, label: c.name }))]} value={categoryId} onChange={setCategoryId} />
      <Text style={ui.label}>Município</Text>
      <Chips options={[{ value: "", label: "Todos" }, ...municipalities.map(m => ({ value: m.id, label: m.name }))]} value={municipalityId} onChange={setMunicipalityId} />
    </View>}
    <Button title="Pesquisar" onPress={() => void search()} />
    <Message error={error} />
    {items?.length === 0 && <Text style={ui.text}>{t.empty}</Text>}
    {items?.map(x => {
      const id = kind === "providers" ? x.user_id : x.id;
      return <Pressable key={id} style={ui.card} accessibilityRole="link" onPress={() => router.push(`${t.base}/${id}` as any)}>
        <Text style={ui.h2}>{kind === "providers" ? x.display_name : x.name}{x.verified ? " ✔️" : ""}</Text>
        {!!(kind === "providers" ? x.headline : x.description) && <Text style={ui.text}>{String(kind === "providers" ? x.headline : x.description).slice(0, 120)}</Text>}
        <Text style={ui.muted}>{[x.category_name, x.municipality_name].filter(Boolean).join(" · ")}</Text>
        <Text style={ui.text}>{ratingLabel(x.rating, x.review_count)}</Text>
      </Pressable>;
    })}
  </ScrollView>;
}

export function DirectoryDetail({ kind, id }: { kind: Kind; id: string }) {
  const router = useRouter();
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
    router.push(("/mensagens?conversation=" + (r.data as any)?.id) as any);
  }
  async function review() {
    if (!uid) { setError("Inicie sessão para avaliar."); return; }
    setBusy(true); setError(""); setNotice("");
    const r = await submitReview(supabase(), target, rating, comment); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setNotice("Obrigado pela sua avaliação."); setComment(""); await load(); }
  }

  if (error && !item) return <View style={ui.screen}><Link href={TEXT[kind].base as any} style={ui.link}>← Voltar</Link><Text style={ui.error}>{error}</Text></View>;
  if (!item) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  const mine = uid === (kind === "providers" ? item.user_id : item.owner_id);
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const wa = whatsappLink(item.whatsapp, "Olá, vi o seu perfil no Huambo Online.");

  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href={TEXT[kind].base as any} style={ui.link}>← Voltar</Link>
    <Text style={ui.h1}>{kind === "providers" ? item.display_name : item.name}{item.verified ? " ✔️" : ""}</Text>
    {kind === "providers" && !!item.headline && <Text style={ui.text}>{item.headline}</Text>}
    <Text style={ui.muted}>{[item.categories?.name, item.municipalities?.name, item.address_text].filter(Boolean).join(" · ")}</Text>
    <Text style={ui.label}>{ratingLabel(avg, reviews.length)}</Text>
    {!!(item.bio || item.description) && <Text style={ui.text}>{item.bio || item.description}</Text>}
    {!!item.phone && <Button title="📞 Ligar" variant="secondary" onPress={() => void Linking.openURL("tel:" + item.phone.replace(/\s/g, ""))} />}
    {!!wa && <Button title="WhatsApp" variant="secondary" onPress={() => void Linking.openURL(wa)} />}
    {mine && <Button title="Editar" onPress={() => router.push((kind === "providers" ? "/conta/profissional" : "/conta/empresas") as any)} />}
    {kind === "providers" && services.length > 0 && <View style={{ gap: 8 }}><Text style={ui.h2}>Serviços</Text>
      {services.map(s => <View key={s.id} style={ui.card}><Text style={ui.label}>{s.title}</Text>{!!s.description && <Text style={ui.text}>{s.description}</Text>}<Text style={ui.text}>{s.price_from != null ? "Desde " + formatPrice(s.price_from, s.currency) : "Preço sob consulta"}</Text></View>)}
    </View>}
    <Message error={error} ok={notice} />
    {!mine && <View style={ui.card}>
      <Text style={ui.h2}>Enviar mensagem</Text>
      <TextInput style={[ui.input, ui.area]} multiline value={message} onChangeText={setMessage} placeholder="Olá, gostaria de pedir um orçamento…" />
      <Button title={busy ? "A enviar…" : "Enviar mensagem"} disabled={busy || !message.trim()} onPress={() => void contact()} />
    </View>}
    <Text style={ui.h2}>Avaliações</Text>
    {!mine && <View style={ui.card}>
      <View style={ui.row}>{[1, 2, 3, 4, 5].map(n => <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n} estrela(s)`} onPress={() => setRating(n)} style={{ padding: 6 }}><Text style={{ fontSize: 34 }}>{n <= rating ? "★" : "☆"}</Text></Pressable>)}</View>
      <TextInput style={[ui.input, ui.area]} multiline value={comment} onChangeText={setComment} placeholder="Como foi a sua experiência?" />
      <Button title="Publicar avaliação" disabled={busy || !rating} onPress={() => void review()} />
    </View>}
    {reviews.length === 0 && <Text style={ui.text}>Ainda sem avaliações.</Text>}
    {reviews.map(r => <View key={r.id} style={ui.card}><Text style={ui.label}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)} — {r.author_name}</Text>{!!r.comment && <Text style={ui.text}>{r.comment}</Text>}<Text style={ui.muted}>{new Date(r.created_at).toLocaleDateString("pt-AO")}</Text></View>)}
  </ScrollView>;
}
