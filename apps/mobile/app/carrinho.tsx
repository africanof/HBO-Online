import { PointPicker } from "../components/Place";
import type { GeoPoint } from "@huambo-online/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { ScrollView, Text, TextInput, View } from "react-native";
import { getMyCart, setCartQuantity, groupCartBySeller, formatPrice, friendlyErrorIn, PAYMENT_LABELS,
  getProtectedSettings, PROTECTED_STEPS, cartDeliveryQuote, cartTotals, defaultFulfillment, deliveryQuoteText, freeDeliveryHint, placeOrdersV3,
  type CartSellerQuote, type DeliveryQuote, type Fulfillment, type PaymentMethod } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { ui, C } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";
import { ChoiceButton, MunicipalityChooser } from "../components/Delivery";
import { useTerritory } from "../components/Directory";
import { useT } from "../lib/i18n";

/** A escolha atual continua válida com o novo preço? (entrega à espera do município também conta.) */
function stillOk(c: Fulfillment | undefined, q: DeliveryQuote) {
  if (c === "pickup") return q.pickup;
  if (c === "delivery") return q.delivery || q.reason === "needs_area";
  return false;
}

export default function Carrinho() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<any[]>([]); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [point, setPoint] = useState<GeoPoint | null>(null); const [payment, setPayment] = useState<PaymentMethod>("cash_on_delivery");
  const [phone, setPhone] = useState(""); const [address, setAddress] = useState(""); const [note, setNote] = useState("");
  const [protectedOn, setProtectedOn] = useState(false); const [useProtected, setUseProtected] = useState<"yes" | "no">("yes");
  // 🚚 Entrega por vendedor: município do comprador, preço de cada vendedor e a escolha (levantamento / entrega).
  const { provinces, municipalities, provinceId, setProvinceId } = useTerritory();
  const [municipality, setMunicipality] = useState<{ id: string; name: string }>({ id: "", name: "" });
  const [quotes, setQuotes] = useState<Record<string, CartSellerQuote>>({}); const [quoting, setQuoting] = useState(false); const [quoteError, setQuoteError] = useState("");
  const [choices, setChoices] = useState<Record<string, Fulfillment | undefined>>({});
  const asked = useRef(0);
  useEffect(() => { void getProtectedSettings(supabase()).then(r => setProtectedOn(!!r.data?.protected_enabled)); }, []);
  const isProtected = protectedOn && useProtected === "yes";
  async function load() { const r = await getMyCart(supabase()); if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems((r.data as any[]) ?? []); }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []));
  async function qty(productId: string, q: number) { const r = await setCartQuantity(supabase(), productId, q); if (r.error) setError(friendlyErrorIn(r.error, lang)); else await load(); }

  // Pede de novo o preço da entrega quando muda o município ou o carrinho (a base de dados faz a conta).
  const cartKey = items.map(i => `${i.product_id}:${i.quantity}`).join(",");
  useEffect(() => {
    if (!uid || !items.length) { setQuotes({}); return; }
    const n = ++asked.current; setQuoting(true); setQuoteError("");
    void cartDeliveryQuote(supabase(), municipality.id || null).then(r => {
      if (n !== asked.current) return;
      setQuoting(false);
      if (r.error) { setQuoteError(friendlyErrorIn(r.error, lang)); return; }
      const map = Object.fromEntries(r.data.map(x => [x.seller_id, x]));
      setQuotes(map);
      setChoices(old => {
        const next: Record<string, Fulfillment | undefined> = {};
        for (const x of r.data) next[x.seller_id] = stillOk(old[x.seller_id], x.quote) ? old[x.seller_id] : defaultFulfillment(x.quote) ?? undefined;
        return next;
      });
    }, () => { if (n === asked.current) { setQuoting(false); setQuoteError(t("sh.dl.quote_failed")); } });
  }, [uid, cartKey, municipality.id]);

  const groups = groupCartBySeller(items);
  const rows = groups.map(g => quotes[g.sellerId]).filter((x): x is CartSellerQuote => !!x);
  const ready = rows.length === groups.length && groups.length > 0;
  const totals = cartTotals(rows, choices);
  const anyDelivery = groups.some(g => choices[g.sellerId] === "delivery");
  const needsArea = anyDelivery && !municipality.id;
  const problem = !ready ? (quoteError || t("sh.dl.calculating")) : needsArea ? tc("Escolha o município da entrega.") : totals.problems.length ? t("sh.dl.fix_problems") : "";

  async function checkout() {
    if (busy || problem) return; setError(""); setBusy(true);
    const picked = Object.fromEntries(groups.map(g => [g.sellerId, choices[g.sellerId]!])) as Record<string, Fulfillment>;
    const r = await placeOrdersV3(supabase(), { choices: picked, paymentMethod: payment, phone, municipalityId: anyDelivery ? municipality.id : null,
      deliveryText: anyDelivery ? address : "", note, protected: isProtected, point: anyDelivery ? point : null }, groups.map(g => g.sellerId)); setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); await load(); return; }
    router.replace((isProtected ? "/encomendas?novas=1&pagar=1" : "/encomendas?novas=1") as any);
  }
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></View>;
  if (!uid) return <View style={ui.screen}><Link href={"/loja" as any} style={ui.link}>{"← " + t("nav.shop")}</Link><Text style={ui.h1}>{t("sh.cart")}</Text><Button title={t("auth.login")} onPress={() => router.push("/login")} /></View>;
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href={"/loja" as any} style={ui.link}>{"← " + t("nav.shop")}</Link>
    <Text style={ui.h1}>{t("sh.cart")}</Text>
    <Message error={error} />
    {items.length === 0 && <Text style={ui.text}>{t("sh.cart_empty")}</Text>}
    {items.length > 0 && <View style={ui.card}>
      <Text style={ui.h2}>{t("sh.dl.where")}</Text>
      <Text style={ui.muted}>{t("sh.dl.where_hint")}</Text>
      <MunicipalityChooser provinces={provinces} municipalities={municipalities} provinceId={provinceId} setProvinceId={setProvinceId}
        value={municipality.id} onChange={(id, name) => setMunicipality({ id, name })} />
    </View>}
    {groups.map(g => {
      const q = quotes[g.sellerId]?.quote; const c = choices[g.sellerId];
      const hint = q && c === "delivery" ? freeDeliveryHint(q) : null;
      return <View key={g.sellerId} style={ui.card}>
        <Text style={ui.label}>{t("sh.seller", { name: g.sellerName })}</Text>
        {g.items.map((it: any) => <View key={it.product_id} style={{ gap: 6, borderTopWidth: 1, borderColor: C.surface, paddingTop: 8 }}>
          <Text style={ui.text}>{it.name} — {formatPrice(it.price, it.currency)}</Text>
          {(!it.active || it.stock < it.quantity) && <Text style={ui.error}>{t("sh.low_stock")}</Text>}
          <View style={ui.row}>
            <Button title="−" variant="secondary" onPress={() => void qty(it.product_id, it.quantity - 1)} />
            <Text style={[ui.h2, { alignSelf: "center" }]}>{it.quantity}</Text>
            <Button title="+" variant="secondary" disabled={it.quantity >= it.stock} onPress={() => void qty(it.product_id, it.quantity + 1)} />
            <Button title={t("sh.remove")} variant="danger" onPress={() => void qty(it.product_id, 0)} />
          </View>
        </View>)}
        <Text style={ui.label}>{t("sh.subtotal", { price: formatPrice(g.total) })}</Text>
        <View style={{ gap: 8, borderTopWidth: 1, borderColor: C.line, paddingTop: 10 }}>
          <Text style={ui.label}>{t("sh.dl.how_receive")}</Text>
          {!q ? <Text style={ui.muted}>{quoteError || t("sh.dl.calculating")}</Text> : <>
            <View style={ui.row}>
              <ChoiceButton label={t("sh.dl.choice_pickup")} on={c === "pickup"} disabled={!q.pickup} onPress={() => setChoices(x => ({ ...x, [g.sellerId]: "pickup" }))} />
              <ChoiceButton label={t("sh.dl.choice_delivery")} on={c === "delivery"} disabled={!q.delivery && q.reason !== "needs_area"} onPress={() => setChoices(x => ({ ...x, [g.sellerId]: "delivery" }))} />
            </View>
            {!q.pickup && <Text style={ui.muted}>{t("sh.dl.no_pickup")}</Text>}
            {c === "pickup" && <Text style={ui.text}>{q.pickup_place ? t("sh.dl.pickup_at", { place: q.pickup_place }) : t("sh.dl.pickup_arrange")}</Text>}
            <Text style={q.delivery || q.reason === "needs_area" ? ui.text : ui.error}>{tc(deliveryQuoteText(q))}</Text>
            {!!hint && <Text style={ui.ok}>{tc(hint)}</Text>}
            {c === "delivery" && !!q.delivery_days && <Text style={ui.muted}>{t("sh.dl.days_line", { days: q.delivery_days })}</Text>}
            {!!q.note && <Text style={ui.muted}>{"ℹ️ " + q.note}</Text>}
            {!c && <Text style={ui.error}>{t("sh.dl.no_option")}</Text>}
          </>}
        </View>
      </View>;
    })}
    {items.length > 0 && <View style={ui.card}>
      <Text style={ui.h2}>{t("sh.checkout", { price: formatPrice(ready ? totals.total : groups.reduce((s, g) => s + g.total, 0)) })}</Text>
      {groups.length > 1 && <Text style={ui.text}>{t("sh.many_orders", { n: groups.length })}</Text>}
      {ready && <View style={{ gap: 2 }}>
        <Text style={ui.text}>{t("sh.dl.sum_items", { price: formatPrice(totals.subtotal) })}</Text>
        <Text style={ui.text}>{anyDelivery ? t("sh.dl.sum_delivery", { price: formatPrice(totals.delivery) }) : t("sh.dl.sum_no_delivery")}</Text>
        <Text style={ui.price}>{t("sh.dl.sum_total", { price: formatPrice(totals.total) })}</Text>
      </View>}
      {anyDelivery && <><Text style={ui.label}>{t("sh.address")}</Text><TextInput style={ui.input} value={address} onChangeText={setAddress} placeholder={t("sh.address_ph")} placeholderTextColor={C.muted} />
        {!!municipality.name && <Text style={ui.muted}>{t("sh.dl.in_municipality", { place: municipality.name })}</Text>}
        <PointPicker point={point} onChange={setPoint} label={t("sh.delivery_point_opt")} hint={t("sh.delivery_point_hint")} /></>}
      {protectedOn && <>
        <Text style={ui.label}>{t("sh.how_pay")}</Text>
        <Chips options={[{ value: "yes" as const, label: t("sh.protected_rec") }, { value: "no" as const, label: t("sh.arrange_seller") }]} value={useProtected} onChange={setUseProtected} />
        {isProtected && <View style={[ui.card, { gap: 4 }]}>{PROTECTED_STEPS.map((step, i) => <Text key={i} style={ui.text}>{i + 1}. {tc(step)}</Text>)}</View>}
      </>}
      {!isProtected && <><Text style={ui.label}>{t("sh.payment")}</Text>
      <Chips options={Object.entries(PAYMENT_LABELS).map(([value, label]) => ({ value: value as PaymentMethod, label: tc(label) }))} value={payment} onChange={setPayment} /></>}
      <Text style={ui.label}>{t("sh.contact_phone")}</Text><TextInput style={ui.input} keyboardType="phone-pad" value={phone} onChangeText={setPhone} placeholder="923 000 000" placeholderTextColor={C.muted} />
      <Text style={ui.label}>{t("sh.note_opt")}</Text><TextInput style={ui.input} value={note} onChangeText={setNote} />
      <Text style={ui.muted}>{isProtected ? t("sh.pay_note_protected")
        : protectedOn ? t("sh.pay_note_arranged") : t("sh.pay_note_none")}</Text>
      {!!problem && <Text accessibilityRole="alert" style={quoting && !quoteError ? ui.muted : ui.error}>{problem}</Text>}
      <Button title={busy ? t("sh.sending") : t("sh.confirm_order")} disabled={busy || !!problem} onPress={() => void checkout()} />
    </View>}
  </ScrollView>;
}
