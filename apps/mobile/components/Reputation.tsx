import { useEffect, useState } from "react";
import { Link } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";
import { getUserStats, requestService, validateServiceRequest, sellerBadge, friendlyErrorIn, validateReview, submitDealReview, listDealCandidates, setListingDeal,
  closeListing, getPlatformSettings, commissionFor, parsePrice, formatPrice, finalDealStatus, quickDates, DEAL_ROLE_LABELS, type UserStats, type PendingReview, type DealCandidate } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { useT } from "../lib/i18n";

/** Chave da tradução do botão para fechar o anúncio. */
const DEAL_BUTTON = { sold: "ls.deal.mark_sold", rented: "ls.deal.mark_rented", closed: "ls.deal.close" } as const;
export const stars = (n: number) => "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));

/** Quadro de números do perfil (vendas, compras, serviços…). */
export function StatsBlock({ rows, footer }: { rows: { label: string; value: string }[]; footer?: string }) {
  const { t, tc } = useT();
  if (rows.length === 0) return null;
  return <View accessibilityLabel={t("ls.rep.stats")} style={{ gap: 8 }}>
    <View style={ui.row}>{rows.map(r => <View key={r.label} style={{ flexBasis: "47%", flexGrow: 1, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, backgroundColor: C.surface }}>
      <Text style={{ fontSize: 22, fontWeight: "800", color: C.ink }}>{tc(r.value)}</Text><Text style={ui.muted}>{tc(r.label)}</Text>
    </View>)}</View>
    {!!footer && <Text style={ui.muted}>{tc(footer)}</Text>}
  </View>;
}

/** Escolher de 1 a 5 estrelas (botões grandes). */
export function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { t } = useT();
  return <View style={ui.row} accessibilityRole="radiogroup">
    {[1, 2, 3, 4, 5].map(n => <Pressable key={n} accessibilityRole="radio" accessibilityState={{ checked: n === value }} accessibilityLabel={t("ls.rep.stars", { n })} onPress={() => onChange(n)} style={{ padding: 6 }}>
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
  const { tc } = useT();
  const text = sellerBadge(s);
  return text ? <Text style={{ alignSelf: "flex-start", fontWeight: "800", color: C.goldText, backgroundColor: C.goldSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, fontSize: 15 }}>{tc(text)}</Text> : null;
}

/** Caixa «Pedir serviço» nas páginas de profissionais e empresas. */
export function RequestServiceBox({ target, signedIn }: { target: { providerId?: string; businessId?: string }; signedIn: boolean }) {
  const { t, tc, lang } = useT();
  const [text, setText] = useState(""); const [date, setDate] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState(false);
  async function send() {
    if (!signedIn) { setError(t("ls.rep.sign_in_service")); return; }
    const v = validateServiceRequest(text); if (v) { setError(tc(v)); return; }
    setBusy(true); setError("");
    const r = await requestService(supabase(), target, text, date); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setDone(true); setText(""); setDate(""); }
  }
  return <View style={ui.card}>
    <Text style={ui.h2}>{t("ls.rep.request_service")}</Text>
    {done ? <><Text style={ui.ok}>{t("ls.rep.request_sent")}</Text><Link href={"/servicos" as any} style={ui.link}>{t("ls.rep.follow_requests")}</Link></> : <>
      <Text style={ui.text}>{t("ls.rep.service_hint")}</Text>
      <TextInput style={[ui.input, ui.area]} multiline value={text} onChangeText={setText} placeholder={t("ls.rep.service_ph")} />
      <Text style={ui.label}>{t("ls.rep.when")}</Text>
      <Chips options={[{ value: "", label: t("ls.rep.no_date") }, ...quickDates(7).map(d => ({ ...d, label: tc(d.label) }))]} value={date} onChange={setDate} />
      <Message error={error} />
      <Button title={busy ? t("ls.sending") : t("ls.rep.send_service")} disabled={busy} onPress={() => void send()} />
    </>}
  </View>;
}

/** Formulário de avaliação de um negócio (encomenda ou anúncio). */
export function DealReviewForm({ item, onDone }: { item: PendingReview; onDone: () => void }) {
  const { t, tc, lang } = useT();
  const [rating, setRating] = useState(0); const [comment, setComment] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function send() {
    const v = validateReview(rating, comment); if (v) { setError(tc(v)); return; }
    setBusy(true); setError("");
    const r = await submitDealReview(supabase(), item.kind, item.ref_id, rating, comment); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else onDone();
  }
  return <View style={ui.card}>
    <Text style={ui.h2}>{item.kind === "order" ? "📦 " : "🏷️ "}{item.title}</Text>
    <Text style={ui.text}>{t("ls.rep.review")} <Link href={("/vendedor/" + item.other_id) as any} style={ui.link}>{item.other_name}</Link> {t("ls.rep.as")} <Text style={ui.label}>{tc(DEAL_ROLE_LABELS[item.other_role])}</Text></Text>
    <StarPicker value={rating} onChange={setRating} />
    <TextInput style={[ui.input, ui.area]} multiline value={comment} onChangeText={setComment} placeholder={t("ls.rep.how_went")} />
    <Message error={error} />
    <Button title={busy ? t("ls.sending") : t("ls.rep.publish_review")} disabled={busy || !rating} onPress={() => void send()} />
  </View>;
}

/** «Com quem fez negócio?» — fecha o anúncio e liga as duas pessoas para se avaliarem. */
export function DealCloser({ listing, onDone }: { listing: { id: string; purpose: string; status: string; deal_with?: string | null; price?: number | string | null }; onDone: (msg: string) => void }) {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false); const [people, setPeople] = useState<DealCandidate[] | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(listing.price != null ? String(Number(listing.price)) : ""); const [pct, setPct] = useState(5);
  const final = finalDealStatus(listing.purpose);
  const charged = (final === "sold" || final === "rented") && listing.status === "published" && listing.purpose !== "auction";
  async function show() {
    setOpen(true); setError("");
    const [r, s] = await Promise.all([listDealCandidates(supabase(), listing.id), getPlatformSettings(supabase())]);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); setPeople(r.data); if (s.data?.listing_commission_pct != null) setPct(Number(s.data.listing_commission_pct));
  }
  async function pick(userId: string | null) {
    const sale = charged ? parsePrice(amount) ?? null : null;
    if (charged && (sale == null || sale <= 0)) { setError(final === "rented" ? t("ls.deal.need_rent") : t("ls.deal.need_sale")); return; }
    setBusy(true); setError("");
    const r = userId ? await setListingDeal(supabase(), listing.id, final, userId, sale) : await closeListing(supabase(), listing.id, final, sale);
    setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    const fee = charged ? " " + t("ls.deal.fee", { amount: formatPrice(commissionFor(sale, pct)) }) : "";
    setOpen(false); onDone((userId ? t("ls.deal.recorded") : t("ls.deal.closed")) + fee);
  }
  if (listing.deal_with) return null;
  if (!open) return <Button title={listing.status === "published" ? t(DEAL_BUTTON[final]) : "⭐ " + t("ls.deal.with_whom")} variant="secondary" onPress={() => void show()} />;
  return <View style={[ui.card, { backgroundColor: C.surface }]}>
    {charged && <View style={{ gap: 6 }}>
      <Text style={ui.label}>{final === "rented" ? t("ls.deal.rent_total") : t("ls.deal.sold_for")}</Text>
      <TextInput style={ui.input} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} accessibilityLabel={t("ls.deal.sale_a11y")} />
      <Text style={ui.text}>{t("ls.deal.commission", { pct, amount: formatPrice(commissionFor(parsePrice(amount), pct)) })}</Text>
    </View>}
    <Text style={ui.label}>{t("ls.deal.with_whom")}</Text>
    <Text style={ui.text}>{t("ls.deal.pick")}</Text>
    {people === null && !error && <Text style={ui.text}>{t("common.loading")}</Text>}
    {people?.length === 0 && <Text style={ui.text}>{t("ls.deal.nobody")}</Text>}
    {people?.map(p => <Button key={p.user_id} title={p.full_name} disabled={busy} onPress={() => void pick(p.user_id)} />)}
    <Message error={error} />
    {listing.status === "published" && <Button title={t("ls.deal.close_nobody")} variant="secondary" disabled={busy} onPress={() => void pick(null)} />}
    <Button title={t("common.back")} variant="secondary" onPress={() => setOpen(false)} />
  </View>;
}
