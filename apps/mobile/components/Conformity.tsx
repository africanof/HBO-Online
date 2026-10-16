import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { getClaimDeadline, openListingClaim, respondListingClaim, buyerListingClaim, listMyListingClaims, listListingClaimsForAdmin, decideListingClaim,
  claimActions, claimRef, claimDeadlineText, parsePrice, formatPrice, friendlyErrorIn, CONFORMITY_DECLARATION, CONFORMITY_GUARANTEE,
  CLAIM_REQUEST_LABELS, CLAIM_REASON_LABELS, CLAIM_STATUS_LABELS, CLAIM_OUTCOME_LABELS,
  type ClaimRequest, type ClaimReason, type ClaimStatus, type ListingClaim, type AdminListingClaim } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { useT, formatDateTimeIn } from "../lib/i18n";

/** Caixa obrigatória nos formulários de anúncio e de produto. */
export function ConformityCheck({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const { tc } = useT();
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onChange(!checked)} style={[ui.card, { flexDirection: "row", gap: 10, alignItems: "flex-start" }]}>
    <View style={{ width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: C.inputBorder, backgroundColor: checked ? C.blue : C.card, alignItems: "center", justifyContent: "center", marginTop: 2 }}>
      {checked && <Text style={{ color: C.onAccent, fontWeight: "900" }}>✓</Text>}
    </View>
    <Text style={[ui.text, { flex: 1, fontWeight: "600" }]}>{tc(CONFORMITY_DECLARATION)}</Text>
  </Pressable>;
}

/** Na página do anúncio: a garantia e, para quem comprou/arrendou, «Não corresponde ao anúncio». */
export function ListingGuarantee({ listingId, uid, mine, wanted }: { listingId: string; uid: string | null; mine: boolean; wanted?: boolean }) {
  const { t, tc, lang } = useT();
  const [deadline, setDeadline] = useState<string | null>(null); const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ClaimReason | "">(""); const [request, setRequest] = useState<ClaimRequest | "">("");
  const [description, setDescription] = useState(""); const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState("");
  useEffect(() => { if (uid && !mine) void getClaimDeadline(supabase(), listingId).then(setDeadline); }, [listingId, uid, mine]);
  if (wanted) return null;
  async function send() {
    setBusy(true); setError("");
    const r = await openListingClaim(supabase(), listingId, { request, reason, description, amount: amount.trim() ? parsePrice(amount) : null });
    setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    setOpen(false); setDone(t("ls.claim.sent"));
  }
  return <View style={ui.card}>
    <Text style={ui.text}>{tc(CONFORMITY_GUARANTEE)}</Text>
    <Message ok={done} />
    {!!deadline && !done && !open && <>
      <Button title={t("ls.claim.open")} variant="secondary" onPress={() => setOpen(true)} />
      <Text style={ui.muted}>{tc(claimDeadlineText(deadline) ?? "")}</Text>
    </>}
    {open && <View style={{ gap: 8 }}>
      <Text style={ui.label}>{t("ls.claim.whats_wrong")}</Text>
      <Chips options={(Object.keys(CLAIM_REASON_LABELS) as ClaimReason[]).map(k => ({ value: k, label: tc(CLAIM_REASON_LABELS[k]) }))} value={reason} onChange={setReason} />
      <Text style={ui.label}>{t("ls.claim.what_want")}</Text>
      <Chips options={(Object.keys(CLAIM_REQUEST_LABELS) as ClaimRequest[]).map(k => ({ value: k, label: tc(CLAIM_REQUEST_LABELS[k]) }))} value={request} onChange={setRequest} />
      {!!request && request !== "exchange" && <><Text style={ui.label}>{t("ls.claim.refund_opt")}</Text><TextInput accessibilityLabel={t("ls.claim.refund")} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} style={ui.input} /></>}
      <Text style={ui.label}>{t("ls.claim.explain")}</Text>
      <TextInput accessibilityLabel={t("ls.claim.explain")} multiline maxLength={1000} value={description} onChangeText={setDescription} placeholder={t("ls.claim.explain_ph")} style={[ui.input, ui.area]} />
      <Text style={ui.muted}>{t("ls.claim.photos_hint")}</Text>
      <Message error={error} />
      <Button title={busy ? t("ls.sending") : t("ls.claim.send")} disabled={busy} onPress={() => void send()} />
      <Button title={t("common.cancel")} variant="secondary" onPress={() => setOpen(false)} />
    </View>}
  </View>;
}

/** Chave da tradução de cada botão. */
const ACTION_LABELS = { accept: "ls.claim.act_accept", decline: "ls.claim.act_decline", confirm: "ls.claim.act_confirm", escalate: "ls.claim.act_escalate", withdraw: "ls.claim.act_withdraw" } as const;

/** Reclamações de anúncios (como comprador e como dono), no ecrã «Devoluções e reembolsos». */
export function ListingClaims() {
  const { t, tc, lang } = useT();
  const [items, setItems] = useState<ListingClaim[]>([]); const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listMyListingClaims(supabase()); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void load(); }, []);
  async function act(c: ListingClaim, a: keyof typeof ACTION_LABELS) {
    setBusy(true); setError(""); setNotice("");
    const n = note[c.id];
    const r = a === "accept" || a === "decline" ? await respondListingClaim(supabase(), c.id, a === "accept", n) : await buyerListingClaim(supabase(), c.id, a, n);
    setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    setNotice(t("ls.claim.updated")); setNote({ ...note, [c.id]: "" }); await load();
  }
  if (!items.length && !error) return null;
  return <View style={{ gap: 10 }}>
    <Text style={ui.h2}>{t("ls.claim.title")}</Text>
    <Text style={ui.muted}>{t("ls.claim.subtitle")}</Text>
    <Message error={error} ok={notice} />
    {items.map(c => { const acts = claimActions(c); return <View key={c.id} style={ui.card}>
      <Text style={ui.label}>{tc(claimRef(c.ref_no))} · {c.listing_title}</Text>
      <Text style={ui.text}>{tc(c.status === "resolved" && c.outcome ? CLAIM_OUTCOME_LABELS[c.outcome] : CLAIM_STATUS_LABELS[c.status])}</Text>
      <Text style={ui.muted}>{c.role === "buyer" ? t("ls.rent.owner", { name: c.other_name }) : t("ls.detail.buyer", { name: c.other_name })} · {tc(CLAIM_REASON_LABELS[c.reason])} · {c.amount ? t("ls.claim.asks_amount", { what: tc(CLAIM_REQUEST_LABELS[c.request]), amount: formatPrice(c.amount) }) : t("ls.claim.asks", { what: tc(CLAIM_REQUEST_LABELS[c.request]) })}</Text>
      <Text style={ui.text}>«{c.description}»</Text>
      {!!c.seller_note && <Text style={ui.text}>{t("ls.claim.owner_reply", { note: c.seller_note })}</Text>}
      {!!c.admin_note && <Text style={ui.text}>{t("ls.claim.admin", { note: c.admin_note })}</Text>}
      {c.role === "seller" && c.status === "open" && <Text style={ui.muted}>{t("ls.claim.respond_by", { date: formatDateTimeIn(c.respond_by, lang) })}</Text>}
      {acts.length > 0 && <>
        <TextInput accessibilityLabel={t("ls.claim.message")} placeholder={t("ls.claim.message_ph")} value={note[c.id] ?? ""} onChangeText={v => setNote({ ...note, [c.id]: v })} maxLength={1000} style={ui.input} />
        {acts.map(a => <Button key={a} title={t(ACTION_LABELS[a])} disabled={busy} variant={a === "accept" || a === "confirm" ? "primary" : "secondary"} onPress={() => void act(c, a)} />)}
      </>}
    </View>; })}
  </View>;
}

/** Administração: reclamações para decidir. */
export function AdminListingClaims() {
  const { t, tc, lang } = useT();
  const [status, setStatus] = useState<ClaimStatus | "all">("escalated"); const [items, setItems] = useState<AdminListingClaim[]>([]);
  const [note, setNote] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listListingClaimsForAdmin(supabase(), status === "all" ? "" : status); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void load(); }, [status]);
  async function decide(c: AdminListingClaim, uphold: boolean) {
    setBusy(true); setError(""); setNotice("");
    const r = await decideListingClaim(supabase(), c.id, uphold, note[c.id] ?? ""); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(uphold ? t("ls.claim.upheld") : t("ls.claim.rejected")); await load(); }
  }
  return <View style={{ gap: 10 }}>
    <Text style={ui.h2}>{t("ls.claim.admin_title")}</Text>
    <Chips options={[...(["escalated", "open", "accepted", "declined", "resolved"] as ClaimStatus[]).map(s => ({ value: s as ClaimStatus | "all", label: tc(CLAIM_STATUS_LABELS[s]) })), { value: "all" as const, label: t("ls.all_f") }]} value={status} onChange={setStatus} />
    <Message error={error} ok={notice} />
    {items.length === 0 && <Text style={ui.text}>{t("ls.claim.nothing")}</Text>}
    {items.map(c => <View key={c.id} style={ui.card}>
      <Text style={ui.label}>{tc(claimRef(c.ref_no))} · {c.listing_title}</Text>
      <Text style={ui.text}>{t("ls.claim.parties", { buyer: c.buyer_name, seller: c.seller_name, n: c.seller_claims })}</Text>
      <Text style={ui.text}>{tc(CLAIM_REASON_LABELS[c.reason])} · {c.amount ? t("ls.claim.asks_amount", { what: tc(CLAIM_REQUEST_LABELS[c.request]), amount: formatPrice(c.amount) }) : t("ls.claim.asks", { what: tc(CLAIM_REQUEST_LABELS[c.request]) })}</Text>
      <Text style={ui.text}>«{c.description}»</Text>
      {!!c.seller_note && <Text style={ui.text}>{t("ls.claim.owner_reply", { note: c.seller_note })}</Text>}
      {!!c.admin_note && <Text style={ui.muted}>{t("ls.claim.note", { note: c.admin_note })}</Text>}
      {c.status !== "resolved" && <>
        <TextInput accessibilityLabel={t("ls.claim.decision")} placeholder={t("ls.claim.decision")} multiline value={note[c.id] ?? ""} onChangeText={v => setNote({ ...note, [c.id]: v })} maxLength={1000} style={[ui.input, ui.area]} />
        <Button title={t("ls.claim.buyer_right")} disabled={busy} onPress={() => void decide(c, true)} />
        <Button title={t("ls.claim.reject")} variant="secondary" disabled={busy} onPress={() => void decide(c, false)} />
        <Text style={ui.muted}>{t("ls.claim.suspend_hint")}</Text>
      </>}
    </View>)}
  </View>;
}
