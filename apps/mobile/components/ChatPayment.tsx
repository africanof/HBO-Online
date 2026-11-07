import { useState } from "react";
import { Image, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { chatPaymentState, requestChatPayment, formatPrice, friendlyErrorIn, parsePrice, type ChatPaymentCard } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui, C } from "../lib/ui";
import { Button, Message, SmallButton } from "./Ui";
import { ProtectedBuyBox } from "./ProtectedBuy";
import { tap } from "../lib/haptics";
import { useT, formatDateTimeIn } from "../lib/i18n";

/** Quem vende: «💳 Pedir pagamento» com o preço combinado (até ao preço do anúncio). */
export function ChatPayAsk({ conversationId, listing, onSent, onClose }: { conversationId: string; listing: { price: number | null; currency: string | null }; onSent: () => void; onClose: () => void }) {
  const { t, lang } = useT();
  const [amount, setAmount] = useState(listing.price ? String(Math.round(Number(listing.price))) : ""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function send() {
    setError(""); const v = parsePrice(amount);
    if (!v || v <= 0) { setError(t("pay.amount")); return; }
    setBusy(true); const r = await requestChatPayment(supabase(), conversationId, v); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { tap(); onSent(); }
  }
  return <View style={[ui.card, { marginHorizontal: 10, marginTop: 6 }]}>
    <Text style={ui.label}>{t("pay.ask_title")}</Text>
    <Text style={ui.muted}>{t("pay.ask_hint", { price: listing.price ? formatPrice(listing.price, listing.currency ?? "AOA") : "—" })}</Text>
    <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" accessibilityLabel={t("pay.amount")} placeholder={t("pay.amount")} style={ui.input} />
    <Message error={error} />
    <View style={{ flexDirection: "row", gap: 8 }}>
      <View style={{ flex: 1 }}><Button title={busy ? t("common.loading") : t("pay.send")} disabled={busy} onPress={() => void send()} /></View>
      <View style={{ flex: 1 }}><Button title={t("common.cancel")} variant="secondary" onPress={onClose} /></View>
    </View>
  </View>;
}

/** Cartão do pedido de pagamento dentro da conversa (os dois lados veem o estado). */
export function ChatPayCard({ card, uid }: { card: ChatPaymentCard; uid: string }) {
  const { t, lang } = useT(); const router = useRouter(); const [paying, setPaying] = useState(false);
  const st = chatPaymentState(card); const amount = formatPrice(card.amount, card.currency);
  const item = { id: card.listing_id, status: card.listing_status, purpose: card.purpose, price: card.amount, currency: card.currency, title: card.title };
  const ok = st === "held" || st === "released"; const off = st === "expired" || st === "cancelled" || st === "unavailable";
  return <View style={{ gap: 8, backgroundColor: C.card, borderRadius: 16, borderWidth: 2, borderColor: ok ? "#0b7a3b" : off ? C.line : C.blue, padding: 12, width: 270 }}>
    <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
      {card.photo ? <Image source={{ uri: card.photo }} style={{ width: 56, height: 56, borderRadius: 10 }} /> : <View style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 26 }}>🛡️</Text></View>}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={ui.muted}>{t("pay.card_title")}</Text>
        <Text style={ui.label} numberOfLines={1}>{card.title}</Text>
        <Text style={{ fontSize: 20, fontWeight: "800", color: C.ink }}>{amount}</Text>
        {!!card.listing_price && card.listing_price > card.amount && <Text style={[ui.muted, { textDecorationLine: "line-through" }]}>{t("pay.was", { price: formatPrice(card.listing_price, card.currency) })}</Text>}
      </View>
    </View>
    {st === "pay" && !paying && <><Button title={t("pay.pay", { amount })} onPress={() => setPaying(true)} /><Text style={ui.muted}>{t("pay.st.pay", { date: formatDateTimeIn(card.expires_at, lang) })}</Text></>}
    {st === "pay" && paying && <ProtectedBuyBox item={item} uid={uid} isJob={false} startOpen onCancel={() => setPaying(false)} />}
    {st === "waiting_buyer" && <Text style={ui.text}>{t("pay.st.waiting_buyer", { date: formatDateTimeIn(card.expires_at, lang) })}</Text>}
    {st !== "pay" && st !== "waiting_buyer" && <Text style={ui.text}>{t("pay.st." + st)}</Text>}
    {card.is_buyer && !!card.order_id && st === "awaiting_payment" && <SmallButton primary title={t("pay.pay_now")} onPress={() => router.push("/encomendas?pagar=1" as any)} />}
    {card.is_buyer && !!card.order_id && ok && <SmallButton title={t("pay.see_order")} onPress={() => router.push("/encomendas" as any)} />}
  </View>;
}
