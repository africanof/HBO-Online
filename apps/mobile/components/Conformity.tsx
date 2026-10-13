import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { getClaimDeadline, openListingClaim, respondListingClaim, buyerListingClaim, listMyListingClaims, listListingClaimsForAdmin, decideListingClaim,
  claimActions, claimRef, claimDeadlineText, parsePrice, formatPrice, friendlyError, CONFORMITY_DECLARATION, CONFORMITY_GUARANTEE,
  CLAIM_REQUEST_LABELS, CLAIM_REASON_LABELS, CLAIM_STATUS_LABELS, CLAIM_OUTCOME_LABELS,
  type ClaimRequest, type ClaimReason, type ClaimStatus, type ListingClaim, type AdminListingClaim } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";

/** Caixa obrigatória nos formulários de anúncio e de produto. */
export function ConformityCheck({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onChange(!checked)} style={[ui.card, { flexDirection: "row", gap: 10, alignItems: "flex-start" }]}>
    <View style={{ width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: C.inputBorder, backgroundColor: checked ? C.blue : C.card, alignItems: "center", justifyContent: "center", marginTop: 2 }}>
      {checked && <Text style={{ color: C.onAccent, fontWeight: "900" }}>✓</Text>}
    </View>
    <Text style={[ui.text, { flex: 1, fontWeight: "600" }]}>{CONFORMITY_DECLARATION}</Text>
  </Pressable>;
}

/** Na página do anúncio: a garantia e, para quem comprou/arrendou, «Não corresponde ao anúncio». */
export function ListingGuarantee({ listingId, uid, mine, wanted }: { listingId: string; uid: string | null; mine: boolean; wanted?: boolean }) {
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
    if (r.error) { setError(friendlyError(r.error)); return; }
    setOpen(false); setDone("Reclamação enviada ao dono. Ele tem 3 dias para responder; se não responder ou recusar, pode pedir à administração para decidir. Acompanhe em «Devoluções e reembolsos».");
  }
  return <View style={ui.card}>
    <Text style={ui.text}>{CONFORMITY_GUARANTEE}</Text>
    <Message ok={done} />
    {!!deadline && !done && !open && <>
      <Button title="↩️ O artigo não corresponde ao anúncio" variant="secondary" onPress={() => setOpen(true)} />
      <Text style={ui.muted}>{claimDeadlineText(deadline)}</Text>
    </>}
    {open && <View style={{ gap: 8 }}>
      <Text style={ui.label}>O que está errado?</Text>
      <Chips options={(Object.keys(CLAIM_REASON_LABELS) as ClaimReason[]).map(k => ({ value: k, label: CLAIM_REASON_LABELS[k] }))} value={reason} onChange={setReason} />
      <Text style={ui.label}>O que quer?</Text>
      <Chips options={(Object.keys(CLAIM_REQUEST_LABELS) as ClaimRequest[]).map(k => ({ value: k, label: CLAIM_REQUEST_LABELS[k] }))} value={request} onChange={setRequest} />
      {!!request && request !== "exchange" && <><Text style={ui.label}>Valor a reembolsar (Kz, opcional)</Text><TextInput accessibilityLabel="Valor a reembolsar" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} style={ui.input} /></>}
      <Text style={ui.label}>Explique o problema</Text>
      <TextInput accessibilityLabel="Explique o problema" multiline maxLength={1000} value={description} onChangeText={setDescription} placeholder="Ex.: o anúncio não dizia que o ecrã está riscado." style={[ui.input, ui.area]} />
      <Text style={ui.muted}>Pode enviar fotografias ao dono pelas mensagens do anúncio.</Text>
      <Message error={error} />
      <Button title={busy ? "A enviar…" : "Enviar reclamação"} disabled={busy} onPress={() => void send()} />
      <Button title="Cancelar" variant="secondary" onPress={() => setOpen(false)} />
    </View>}
  </View>;
}

const ACTION_LABELS = { accept: "✅ Aceitar (vou cumprir)", decline: "❌ Recusar", confirm: "✔ Já está resolvido", escalate: "⚖️ Pedir à administração", withdraw: "Retirar a reclamação" } as const;

/** Reclamações de anúncios (como comprador e como dono), no ecrã «Devoluções e reembolsos». */
export function ListingClaims() {
  const [items, setItems] = useState<ListingClaim[]>([]); const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listMyListingClaims(supabase()); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useEffect(() => { void load(); }, []);
  async function act(c: ListingClaim, a: keyof typeof ACTION_LABELS) {
    setBusy(true); setError(""); setNotice("");
    const n = note[c.id];
    const r = a === "accept" || a === "decline" ? await respondListingClaim(supabase(), c.id, a === "accept", n) : await buyerListingClaim(supabase(), c.id, a, n);
    setBusy(false);
    if (r.error) { setError(friendlyError(r.error)); return; }
    setNotice("Reclamação atualizada. A outra pessoa recebe um aviso."); setNote({ ...note, [c.id]: "" }); await load();
  }
  if (!items.length && !error) return null;
  return <View style={{ gap: 10 }}>
    <Text style={ui.h2}>🛡️ Reclamações de anúncios</Text>
    <Text style={ui.muted}>Quando o artigo comprado ou arrendado não corresponde ao anúncio.</Text>
    <Message error={error} ok={notice} />
    {items.map(c => { const acts = claimActions(c); return <View key={c.id} style={ui.card}>
      <Text style={ui.label}>{claimRef(c.ref_no)} · {c.listing_title}</Text>
      <Text style={ui.text}>{c.status === "resolved" && c.outcome ? CLAIM_OUTCOME_LABELS[c.outcome] : CLAIM_STATUS_LABELS[c.status]}</Text>
      <Text style={ui.muted}>{c.role === "buyer" ? "Dono" : "Comprador"}: {c.other_name} · {CLAIM_REASON_LABELS[c.reason]} · pede {CLAIM_REQUEST_LABELS[c.request]}{c.amount ? " de " + formatPrice(c.amount) : ""}</Text>
      <Text style={ui.text}>«{c.description}»</Text>
      {!!c.seller_note && <Text style={ui.text}>Resposta do dono: {c.seller_note}</Text>}
      {!!c.admin_note && <Text style={ui.text}>Administração: {c.admin_note}</Text>}
      {c.role === "seller" && c.status === "open" && <Text style={ui.muted}>Responda até {new Date(c.respond_by).toLocaleString("pt-AO")}. Sem resposta, a administração decide.</Text>}
      {acts.length > 0 && <>
        <TextInput accessibilityLabel="Mensagem" placeholder="Mensagem (obrigatória para recusar)" value={note[c.id] ?? ""} onChangeText={v => setNote({ ...note, [c.id]: v })} maxLength={1000} style={ui.input} />
        {acts.map(a => <Button key={a} title={ACTION_LABELS[a]} disabled={busy} variant={a === "accept" || a === "confirm" ? "primary" : "secondary"} onPress={() => void act(c, a)} />)}
      </>}
    </View>; })}
  </View>;
}

/** Administração: reclamações para decidir. */
export function AdminListingClaims() {
  const [status, setStatus] = useState<ClaimStatus | "all">("escalated"); const [items, setItems] = useState<AdminListingClaim[]>([]);
  const [note, setNote] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listListingClaimsForAdmin(supabase(), status === "all" ? "" : status); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useEffect(() => { void load(); }, [status]);
  async function decide(c: AdminListingClaim, uphold: boolean) {
    setBusy(true); setError(""); setNotice("");
    const r = await decideListingClaim(supabase(), c.id, uphold, note[c.id] ?? ""); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(uphold ? "Decidido a favor do comprador." : "Reclamação recusada."); await load(); }
  }
  return <View style={{ gap: 10 }}>
    <Text style={ui.h2}>🛡️ Reclamações de anúncios (conformidade)</Text>
    <Chips options={[...(["escalated", "open", "accepted", "declined", "resolved"] as ClaimStatus[]).map(s => ({ value: s as ClaimStatus | "all", label: CLAIM_STATUS_LABELS[s] })), { value: "all" as const, label: "Todas" }]} value={status} onChange={setStatus} />
    <Message error={error} ok={notice} />
    {items.length === 0 && <Text style={ui.text}>Nada aqui.</Text>}
    {items.map(c => <View key={c.id} style={ui.card}>
      <Text style={ui.label}>{claimRef(c.ref_no)} · {c.listing_title}</Text>
      <Text style={ui.text}>Comprador {c.buyer_name} · Dono {c.seller_name} ({c.seller_claims} no total)</Text>
      <Text style={ui.text}>{CLAIM_REASON_LABELS[c.reason]} · pede {CLAIM_REQUEST_LABELS[c.request]}{c.amount ? " de " + formatPrice(c.amount) : ""}</Text>
      <Text style={ui.text}>«{c.description}»</Text>
      {!!c.seller_note && <Text style={ui.text}>Resposta do dono: {c.seller_note}</Text>}
      {!!c.admin_note && <Text style={ui.muted}>Nota: {c.admin_note}</Text>}
      {c.status !== "resolved" && <>
        <TextInput accessibilityLabel="Decisão e motivo" placeholder="Decisão e motivo" multiline value={note[c.id] ?? ""} onChangeText={v => setNote({ ...note, [c.id]: v })} maxLength={1000} style={[ui.input, ui.area]} />
        <Button title="⚖️ O comprador tem razão" disabled={busy} onPress={() => void decide(c, true)} />
        <Button title="Recusar a reclamação" variant="secondary" disabled={busy} onPress={() => void decide(c, false)} />
        <Text style={ui.muted}>Se o dono não cumprir a decisão, suspenda a conta em «Utilizadores».</Text>
      </>}
    </View>)}
  </View>;
}
