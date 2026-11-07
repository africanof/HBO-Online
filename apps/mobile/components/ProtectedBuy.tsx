import { useEffect, useState } from "react";
import { success } from "../lib/haptics";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { listingCheckoutKind, listingReserved, myListingOrder, buyListingProtected, validateListingCheckout, formatPrice, friendlyErrorIn,
  type MyListingOrder } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui, C } from "../lib/ui";
import { Button, Message } from "./Ui";
import { useT } from "../lib/i18n";

/** Compra de um anúncio com pagamento protegido (obrigatório) — igual ao Site. */
export function ProtectedBuyBox({ item, uid, isJob, startOpen, onCancel }: { item: any; uid: string | null; isJob: boolean; startOpen?: boolean; onCancel?: () => void }) {
  const { lang, t } = useT();
  const router = useRouter();
  const kind = listingCheckoutKind(item, isJob);
  const [reserved, setReserved] = useState(false);
  const [mine, setMine] = useState<MyListingOrder | null>(null);
  const [open, setOpen] = useState(!!startOpen);
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [phone, setPhone] = useState(""); const [address, setAddress] = useState(""); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");

  useEffect(() => {
    if (!item?.id || item.status !== "published" || item.purpose === "wanted" || isJob) return;
    void listingReserved(supabase(), item.id).then(setReserved);
    if (uid) void myListingOrder(supabase(), item.id).then(setMine);
  }, [item?.id, uid]);

  const goOrders = (pay: boolean) => router.push((pay ? "/encomendas?pagar=1" : "/encomendas") as any);
  if (mine) return <View style={[ui.card, { borderColor: C.blue }]}>
    <Text style={ui.label}>{t(mine.escrow_status === "held" ? "pp.yours_held" : "pp.yours_pay", { total: formatPrice(mine.total, item.currency) })}</Text>
    <Button title={mine.escrow_status === "held" ? t("pp.see_order") : t("pp.pay_now")} onPress={() => goOrders(mine.escrow_status === "awaiting_payment")} />
  </View>;
  if (item?.status === "published" && reserved && item.purpose !== "wanted" && !isJob) return <Text style={[ui.text, { fontWeight: "700" }]}>{t("pp.reserved")}</Text>;
  if (!kind) return item?.sale_mode === "offers" && item.purpose === "sale" ? <Text style={ui.muted}>🛡️ {t("pp.offer_hint")}</Text> : null;

  async function submit() {
    setError("");
    if (!uid) { setError(t("pp.login")); return; }
    const bad = validateListingCheckout({ fulfillment, phone, deliveryText: address, note });
    if (bad) { setError(t(bad)); return; }
    setBusy(true);
    const r = await buyListingProtected(supabase(), item.id, { fulfillment, phone, deliveryText: address, note });
    setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    success();
    goOrders(true);
  }

  const label = t(kind === "rent" ? "pp.rent" : kind === "lease" ? "pp.lease" : "pp.buy") + " · " + formatPrice(item.price, item.currency);
  const how = t("pp.how") + (kind === "rent" ? " " + t("pp.rent_first") : "");
  if (!open) return <View style={{ gap: 6 }}>
    <Button title={label} onPress={() => { if (!uid) { router.push("/login" as any); return; } setOpen(true); }} />
    <Text style={ui.muted}>{how}</Text>
  </View>;

  const choice = (v: "pickup" | "delivery", text: string) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: fulfillment === v }}
    onPress={() => setFulfillment(v)} style={fulfillment === v ? ui.chipOn : ui.chip}><Text style={fulfillment === v ? ui.chipTextOn : ui.chipText}>{text}</Text></Pressable>;
  return <View style={ui.card}>
    <Text style={ui.label}>{label}</Text>
    <Text style={ui.muted}>{how}</Text>
    <Text style={ui.label}>{t("pp.handover")}</Text>
    <View style={ui.row}>{choice("pickup", t("pp.in_person"))}{choice("delivery", t("pp.delivery"))}</View>
    <Text style={ui.label}>{t("pp.phone")}</Text>
    <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" style={ui.input} />
    {fulfillment === "delivery" && <><Text style={ui.label}>{t("pp.address")}</Text><TextInput value={address} onChangeText={setAddress} style={ui.input} /></>}
    <Text style={ui.label}>{t("pp.note")}</Text>
    <TextInput value={note} onChangeText={setNote} maxLength={500} style={ui.input} />
    <Message error={error} />
    <Button title={busy ? t("common.loading") : t("pp.continue")} disabled={busy} onPress={() => void submit()} />
    <Button title={t("common.cancel")} variant="secondary" onPress={() => { setOpen(false); onCancel?.(); }} />
    <Text style={ui.muted}>🛡️ {t("pp.never_outside")}</Text>
  </View>;
}
