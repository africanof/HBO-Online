"use client";
import { useEffect, useState } from "react";
import { listingCheckoutKind, listingReserved, myListingOrder, buyListingProtected, validateListingCheckout, orderHref, formatPrice, friendlyErrorIn,
  type MyListingOrder } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT } from "../lib/i18n";
import { CheckoutForm } from "./Checkout";

/**
 * Compra de um anúncio com pagamento protegido (obrigatório): comprar, arrendar ou alugar cria uma encomenda
 * paga ao Huambo Online. Mostra «Reservado» quando outra pessoa está a pagar e «Pagar agora» a quem já reservou.
 */
export function ProtectedBuyBox({ item, uid, isJob, startOpen, onCancel }: { item: any; uid: string | null; isJob: boolean; startOpen?: boolean; onCancel?: () => void }) {
  const { lang, t } = useT();
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

  // A minha compra reservada (pela compra, por proposta aceite, leilão ganho ou aluguer aceite).
  if (mine) return <div className="card stack" style={{ gap: 8, borderColor: "var(--accent)" }}>
    <strong>{t(mine.escrow_status === "held" ? "pp.yours_held" : "pp.yours_pay", { total: formatPrice(mine.total, item.currency) })}</strong>
    <a className="btn" href={orderHref(mine.id, mine.escrow_status === "awaiting_payment")} style={{ justifySelf: "start" }}>{mine.escrow_status === "held" ? t("pp.see_order") : t("pp.pay_now")}</a>
  </div>;
  if (item?.status === "published" && reserved && item.purpose !== "wanted" && !isJob) return <p className="scam-warn" style={{ margin: 0 }}>{t("pp.reserved")}</p>;
  if (!kind) return item?.sale_mode === "offers" && item.purpose === "sale" ? <p className="muted" style={{ margin: 0 }}>🛡️ {t("pp.offer_hint")}</p> : null;

  async function submit() {
    setError("");
    if (!uid) { setError(t("pp.login")); return; }
    const bad = validateListingCheckout({ fulfillment, phone, deliveryText: address, note });
    if (bad) { setError(t(bad)); return; }
    setBusy(true);
    const r = await buyListingProtected(supabase(), item.id, { fulfillment, phone, deliveryText: address, note });
    setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    window.location.href = orderHref(String(r.data), true);
  }

  const label = t(kind === "rent" ? "pp.rent" : kind === "lease" ? "pp.lease" : "pp.buy");
  if (!open) return <div className="stack" style={{ gap: 6 }}>
    <button type="button" onClick={() => { if (!uid) { window.location.href = "/conta/login?voltar=" + encodeURIComponent(location.pathname); return; } setOpen(true); }}>
      {label} · {formatPrice(item.price, item.currency)}</button>
    <small className="muted">{t("pp.how")}{kind === "rent" ? " " + t("pp.rent_first") : ""}</small>
  </div>;

  return <CheckoutForm item={item} uid={uid!} label={label} onCancel={() => { setOpen(false); onCancel?.(); }} />;
}
