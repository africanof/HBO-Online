import { useEffect, useState } from "react";
import { Link } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";
import { getUserStats, requestService, validateServiceRequest, sellerBadge, friendlyError, validateReview, submitDealReview, listDealCandidates, setListingDeal,
  closeListing, getPlatformSettings, commissionFor, parsePrice, formatPrice, finalDealStatus, quickDates, DEAL_ROLE_LABELS, type UserStats, type PendingReview, type DealCandidate } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";

const DEAL_BUTTON = { sold: "Marcar vendido", rented: "Marcar arrendado", closed: "Fechar" } as const;
export const stars = (n: number) => "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));

/** Quadro de números do perfil (vendas, compras, serviços…). */
export function StatsBlock({ rows, footer }: { rows: { label: string; value: string }[]; footer?: string }) {
  if (rows.length === 0) return null;
  return <View accessibilityLabel="Números do perfil" style={{ gap: 8 }}>
    <View style={ui.row}>{rows.map(r => <View key={r.label} style={{ flexBasis: "47%", flexGrow: 1, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, backgroundColor: C.surface }}>
      <Text style={{ fontSize: 22, fontWeight: "800", color: C.ink }}>{r.value}</Text><Text style={ui.muted}>{r.label}</Text>
    </View>)}</View>
    {!!footer && <Text style={ui.muted}>{footer}</Text>}
  </View>;
}

/** Escolher de 1 a 5 estrelas (botões grandes). */
export function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return <View style={ui.row} accessibilityRole="radiogroup">
    {[1, 2, 3, 4, 5].map(n => <Pressable key={n} accessibilityRole="radio" accessibilityState={{ checked: n === value }} accessibilityLabel={`${n} estrela(s)`} onPress={() => onChange(n)} style={{ padding: 6 }}>
      <Text style={{ fontSize: 36, color: n <= value ? C.starOn : C.starOff }}>{n <= value ? "★" : "☆"}</Text>
    </Pressable>)}
  </View>;
}

export function VerifiedTag({ text }: { text: string }) {
  return <Text style={{ alignSelf: "flex-start", fontWeight: "800", color: C.greenText, backgroundColor: C.greenSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, fontSize: 14 }}>{text}</Text>;
}

/** «★ 4,8 (12) · 23 vendas» ao lado do nome do vendedor. */
export function SellerBadge({ userId }: { userId?: string | null }) {
  const [s, setS] = useState<UserStats | null>(null);
  useEffect(() => { if (userId) void getUserStats(supabase(), userId).then(r => setS(r.data)); }, [userId]);
  const text = sellerBadge(s);
  return text ? <Text style={{ alignSelf: "flex-start", fontWeight: "800", color: C.goldText, backgroundColor: C.goldSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, fontSize: 15 }}>{text}</Text> : null;
}

/** Caixa «Pedir serviço» nas páginas de profissionais e empresas. */
export function RequestServiceBox({ target, signedIn }: { target: { providerId?: string; businessId?: string }; signedIn: boolean }) {
  const [text, setText] = useState(""); const [date, setDate] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState(false);
  async function send() {
    if (!signedIn) { setError("Inicie sessão para pedir um serviço."); return; }
    const v = validateServiceRequest(text); if (v) { setError(v); return; }
    setBusy(true); setError("");
    const r = await requestService(supabase(), target, text, date); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setDone(true); setText(""); setDate(""); }
  }
  return <View style={ui.card}>
    <Text style={ui.h2}>🛠️ Pedir serviço</Text>
    {done ? <><Text style={ui.ok}>Pedido enviado!</Text><Link href={"/servicos" as any} style={ui.link}>Acompanhar pedidos de serviço →</Link></> : <>
      <Text style={ui.text}>Diga o que precisa. Quando o serviço terminar, confirma e avalia — a avaliação fica marcada «✔ Serviço confirmado».</Text>
      <TextInput style={[ui.input, ui.area]} multiline value={text} onChangeText={setText} placeholder="Ex.: Instalar 3 tomadas na sala, no bairro São João." />
      <Text style={ui.label}>Para quando? (opcional)</Text>
      <Chips options={[{ value: "", label: "Sem data" }, ...quickDates(7)]} value={date} onChange={setDate} />
      <Message error={error} />
      <Button title={busy ? "A enviar…" : "Enviar pedido de serviço"} disabled={busy} onPress={() => void send()} />
    </>}
  </View>;
}

/** Formulário de avaliação de um negócio (encomenda ou anúncio). */
export function DealReviewForm({ item, onDone }: { item: PendingReview; onDone: () => void }) {
  const [rating, setRating] = useState(0); const [comment, setComment] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function send() {
    const v = validateReview(rating, comment); if (v) { setError(v); return; }
    setBusy(true); setError("");
    const r = await submitDealReview(supabase(), item.kind, item.ref_id, rating, comment); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else onDone();
  }
  return <View style={ui.card}>
    <Text style={ui.h2}>{item.kind === "order" ? "📦 " : "🏷️ "}{item.title}</Text>
    <Text style={ui.text}>Avaliar <Link href={("/vendedor/" + item.other_id) as any} style={ui.link}>{item.other_name}</Link> como <Text style={ui.label}>{DEAL_ROLE_LABELS[item.other_role]}</Text></Text>
    <StarPicker value={rating} onChange={setRating} />
    <TextInput style={[ui.input, ui.area]} multiline value={comment} onChangeText={setComment} placeholder="Como correu o negócio? (opcional)" />
    <Message error={error} />
    <Button title={busy ? "A enviar…" : "Publicar avaliação"} disabled={busy || !rating} onPress={() => void send()} />
  </View>;
}

/** «Com quem fez negócio?» — fecha o anúncio e liga as duas pessoas para se avaliarem. */
export function DealCloser({ listing, onDone }: { listing: { id: string; purpose: string; status: string; deal_with?: string | null; price?: number | string | null }; onDone: (msg: string) => void }) {
  const [open, setOpen] = useState(false); const [people, setPeople] = useState<DealCandidate[] | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(listing.price != null ? String(Number(listing.price)) : ""); const [pct, setPct] = useState(5);
  const final = finalDealStatus(listing.purpose);
  const charged = final === "sold" && listing.status === "published" && listing.purpose !== "auction";
  async function show() {
    setOpen(true); setError("");
    const [r, s] = await Promise.all([listDealCandidates(supabase(), listing.id), getPlatformSettings(supabase())]);
    if (r.error) setError(friendlyError(r.error)); setPeople(r.data); if (s.data?.listing_commission_pct != null) setPct(Number(s.data.listing_commission_pct));
  }
  async function pick(userId: string | null) {
    const sale = charged ? parsePrice(amount) ?? null : null;
    if (charged && (sale == null || sale <= 0)) { setError("Indique por quanto vendeu."); return; }
    setBusy(true); setError("");
    const r = userId ? await setListingDeal(supabase(), listing.id, final, userId, sale) : await closeListing(supabase(), listing.id, final, sale);
    setBusy(false);
    if (r.error) { setError(friendlyError(r.error)); return; }
    const fee = charged ? ` Comissão a pagar: ${formatPrice(commissionFor(sale, pct))} (em «Comissões»).` : "";
    setOpen(false); onDone((userId ? "Negócio registado. Já se podem avaliar um ao outro em «Avaliações»." : "Anúncio fechado.") + fee);
  }
  if (listing.deal_with) return null;
  if (!open) return <Button title={listing.status === "published" ? DEAL_BUTTON[final] : "⭐ Com quem fez negócio?"} variant="secondary" onPress={() => void show()} />;
  return <View style={[ui.card, { backgroundColor: C.surface }]}>
    {charged && <View style={{ gap: 6 }}>
      <Text style={ui.label}>Por quanto vendeu? (Kz)</Text>
      <TextInput style={ui.input} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} accessibilityLabel="Valor da venda em Kz" />
      <Text style={ui.text}>Comissão da plataforma ({pct}%): {formatPrice(commissionFor(parsePrice(amount), pct))} — paga em 7 dias em «Comissões».</Text>
    </View>}
    <Text style={ui.label}>Com quem fez negócio?</Text>
    <Text style={ui.text}>Escolha a pessoa para se avaliarem um ao outro.</Text>
    {people === null && !error && <Text style={ui.text}>A carregar…</Text>}
    {people?.length === 0 && <Text style={ui.text}>Ninguém lhe enviou mensagem sobre este anúncio.</Text>}
    {people?.map(p => <Button key={p.user_id} title={p.full_name} disabled={busy} onPress={() => void pick(p.user_id)} />)}
    <Message error={error} />
    {listing.status === "published" && <Button title="Fechar sem indicar ninguém" variant="secondary" disabled={busy} onPress={() => void pick(null)} />}
    <Button title="Voltar" variant="secondary" onPress={() => setOpen(false)} />
  </View>;
}
