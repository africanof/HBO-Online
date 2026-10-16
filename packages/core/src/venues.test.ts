import { describe, expect, it, vi } from "vitest";
import { venueRef, venueOrderRef, venueKindFromSlug, venueOrderKinds, nightsBetween, nightsText, dateText, luandaToday, addDays, luandaDateTimeToIso,
  venuePriceText, venueAvailabilityText, venueFeedBadge, venueOrderSummary, venueFeeBreakdown, venueFeeNotice, venueOwnerFeeNotice, venueVerifyUrl, venueTokenFromText,
  normalizeVenueCode, venueTransferNote, venueShareMessage, validateVenue, validateVenueItem, validateVenueReserve, saveVenue, saveVenueItem, deleteVenueItem,
  reserveVenue, submitVenuePayment, decideVenuePayment, completeVenueOrder, venueOrderByToken, venueDetail, venuePanel, setVenueStatus, submitVenueFee, decideVenueFee,
  myVenueOrders, venueFeed, VENUE_KINDS, VENUE_COMPLETE_LABELS, type VenueInput, type VenueReserveInput } from "./venues";
import { friendlyError } from "./classified-listings";
import { getNotificationLink } from "./notifications";
import { HOME_CATEGORIES } from "./design";
import { directoryHeading } from "./directory";
import { REVENUE_KIND_LABELS } from "./plans";

const rpc = (data: unknown = null) => ({ rpc: vi.fn().mockResolvedValue({ data, error: null }) }) as any;
const venue: VenueInput = { businessId: "b1", kind: "hotel", subtype: "resort", acceptsReservations: true, acceptsPayAtPlace: true, acceptsPrepay: false, holdMinutes: 60,
  pay: { holder: "", iban: "", express: "", note: "" } };
const room = { id: "r1", name: "Quarto duplo", price: 20000, min_qty: 1, free: 2, available: true, capacity: 2, unit: "noite" };
const rice = { id: "p1", name: "Arroz 25 kg", price: 15000, min_qty: 10, free: 100, available: true, capacity: null, unit: "saco" };
const hotelInfo = { kind: "hotel" as const, accepts_pay_at_place: true, accepts_prepay: false };

describe("reservas: textos", () => {
  it("referências, tipos e datas", () => {
    expect(venueRef(1001)).toBe("E-1001"); expect(venueOrderRef(1002)).toBe("R-1002");
    expect(venueKindFromSlug("Hoteis")).toBe("hotel"); expect(venueKindFromSlug("armazens")).toBe("warehouse"); expect(venueKindFromSlug("x")).toBeNull();
    expect(venueOrderKinds("hotel")).toEqual(["stay"]); expect(venueOrderKinds("restaurant")).toEqual(["table", "order"]); expect(venueOrderKinds("warehouse")).toEqual(["order"]);
    expect(nightsBetween("2026-10-20", "2026-10-23")).toBe(3); expect(nightsText(1)).toBe("1 noite"); expect(nightsText(2)).toBe("2 noites");
    expect(dateText("2026-10-20")).toBe("20/10/2026"); expect(dateText(null)).toBe("");
    expect(luandaToday(Date.parse("2026-10-16T23:30:00Z"))).toBe("2026-10-17"); expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(luandaDateTimeToIso("2026-10-20", "19:30")).toBe("2026-10-20T18:30:00.000Z"); expect(luandaDateTimeToIso("20/10", "19:30")).toBeNull();
    expect(VENUE_KINDS.hotel.subtypes).toContain("casa_passagem");
  });
  it("preço, disponibilidade e resumo", () => {
    expect(venuePriceText({ price: 20000, unit: null }, "hotel")).toMatch(/^20.000 Kz \/ noite$/);
    expect(venuePriceText({ price: 500, unit: "caixa" }, "warehouse")).toBe("500 Kz / caixa");
    expect(venueAvailabilityText({ available: true, free: 3, unit: null }, "hotel")).toBe("🟢 Há 3 quartos livres");
    expect(venueAvailabilityText({ available: true, free: 1, unit: null }, "hotel")).toBe("🟢 Há 1 quarto livre");
    expect(venueAvailabilityText({ available: true, free: 0, unit: null }, "hotel")).toContain("Sem quartos livres");
    expect(venueAvailabilityText({ available: false, free: 3, unit: null }, "hotel")).toBe("🔴 Sem quartos");
    expect(venueAvailabilityText({ available: true, free: null, unit: null }, "restaurant")).toBe("🟢 Há");
    expect(venueAvailabilityText({ available: true, free: 40, unit: "sacos" }, "warehouse")).toBe("🟢 Há 40 sacos");
    expect(venueAvailabilityText({ available: false, free: 40, unit: "sacos" }, "warehouse")).toBe("🔴 Esgotado");
    expect(venueFeedBadge({ kind: "hotel", has_now: true, rooms_free: 4 })).toBe("🟢 4 quartos livres hoje");
    expect(venueFeedBadge({ kind: "hotel", has_now: false, rooms_free: 0 })).toBe("🔴 Sem quartos livres hoje");
    expect(venueFeedBadge({ kind: "warehouse", has_now: true, rooms_free: null })).toBe("🟢 Aberto a pedidos");
    expect(venueOrderSummary({ kind: "stay", guests: 2, check_in: "2026-10-20", check_out: "2026-10-22", slot_at: null, lines: [{ name: "Quarto duplo", unit: "noite", qty: 1 }] }))
      .toBe("1 × Quarto duplo (noite) · 20/10/2026 → 22/10/2026 (2 noites) · 2 pessoas");
    expect(venueOrderSummary({ kind: "table", guests: 4, check_in: null, check_out: null, slot_at: "2026-10-20T18:30:00Z", lines: [] })).toMatch(/^Mesa para 4 · /);
    expect(venueOrderSummary({ kind: "order", guests: null, check_in: null, check_out: null, slot_at: null, lines: [{ name: "Arroz", unit: "saco", qty: 2.5 }] })).toBe("2,5 × Arroz (saco)");
  });
  it("taxa: 5% do cliente + 5% do estabelecimento", () => {
    expect(venueFeeBreakdown([{ price: 20000, qty: 1 }], 5, 5, 2)).toEqual({ subtotal: 40000, clientFee: 2000, businessFee: 2000, total: 42000, platform: 4000, businessGets: 38000 });
    expect(venueFeeBreakdown([{ price: 15000, qty: 20 }, { price: 999, qty: 1 }], 5, 5)).toEqual({ subtotal: 300999, clientFee: 15050, businessFee: 15050, total: 316049, platform: 30100, businessGets: 285949 });
    expect(venueFeeBreakdown([], 5, 5).total).toBe(0);
    expect(venueFeeNotice(5)).toContain("5% de taxa de serviço");
    expect(venueOwnerFeeNotice(5, 5)).toContain("10% de cada pedido concluído");
  });
  it("QR, código e partilha", () => {
    const t = "0123456789abcdef0123456789abcdef";
    expect(venueVerifyUrl("https://h.ao/", t)).toBe("https://h.ao/reservas/v/" + t);
    expect(venueTokenFromText("https://h.ao/reservas/v/" + t.toUpperCase())).toBe(t); expect(venueTokenFromText(t)).toBe(t); expect(venueTokenFromText("olá")).toBeNull();
    expect(normalizeVenueCode("rv abc234")).toBe("RV-ABC234"); expect(normalizeVenueCode("abc234")).toBe("RV-ABC234");
    expect(venueTransferNote(1005)).toBe("Escreva no descritivo da transferência: R-1005");
    expect(venueShareMessage("https://h.ao", { id: "v1", name: "Hotel Ekuikui", kind: "hotel", municipality_name: "Huambo" })).toBe("🏨 Hotel Ekuikui, Huambo — reserve no Huambo Online\n👉 https://h.ao/reservas/v1");
    expect(VENUE_COMPLETE_LABELS.used).toContain("JÁ FOI USADO");
  });
  it("categorias, notificações, receitas e erros", () => {
    for (const k of ["hoteis", "restaurantes", "armazens"]) expect(HOME_CATEGORIES.some(c => c.href === "/reservas?tipo=" + k)).toBe(true);
    expect(directoryHeading("hoteis")?.title).toContain("Hotéis");
    expect(getNotificationLink({ data: { for: "venue", venue_id: "11111111-1111-4111-8111-111111111111" }, type: "system", title: "" })?.href).toBe("/reservas/11111111-1111-4111-8111-111111111111/gerir");
    expect(getNotificationLink({ data: { for: "venue_orders" }, type: "system", title: "" })?.href).toBe("/reservas/minhas");
    expect(getNotificationLink({ data: { venue_id: "11111111-1111-4111-8111-111111111111" }, type: "system", title: "" })?.href).toBe("/admin");
    expect(REVENUE_KIND_LABELS.venue_fee).toContain("reservas");
    expect(friendlyError({ message: "VENUE_NO_ROOMS" })).toContain("quartos livres");
    expect(friendlyError({ message: "VENUE_BELOW_MINIMUM" })).toContain("mínimo");
    expect(friendlyError({ message: "VENUE_REFERENCE_USED" })).toContain("já foi usada");
    expect(friendlyError({ message: "CANNOT_BUY_OWN" })).toContain("estabelecimento");
    expect(friendlyError({ message: 'duplicate key value violates unique constraint "venues_business_id_key"' })).toContain("já está registada");
  });
});

describe("reservas: validação", () => {
  it("estabelecimento", () => {
    expect(validateVenue(venue)).toBeNull();
    expect(validateVenue({ ...venue, businessId: "" })).toContain("empresa");
    expect(validateVenue({ ...venue, subtype: "armazem" })).toContain("tipo");
    expect(validateVenue({ ...venue, acceptsPayAtPlace: false })).toContain("forma de pagamento");
    expect(validateVenue({ ...venue, acceptsPrepay: true })).toContain("IBAN");
    expect(validateVenue({ ...venue, acceptsPrepay: true, pay: { holder: "Hotel Lda", iban: "AO06", express: "", note: "" } })).toBeNull();
    expect(validateVenue({ ...venue, checkInTime: "2pm" })).toContain("entrada");
    expect(validateVenue({ ...venue, holdMinutes: 5 })).toContain("tolerância");
  });
  it("quartos, pratos e produtos", () => {
    expect(validateVenueItem("hotel", { name: "Duplo", photos: [], price: 20000, available: true, qtyTotal: 3, capacity: 2 })).toBeNull();
    expect(validateVenueItem("hotel", { name: "Duplo", photos: [], price: 20000, available: true, qtyTotal: null, capacity: 2 })).toContain("Quantos quartos");
    expect(validateVenueItem("hotel", { name: "Duplo", photos: [], price: 20000, available: true, qtyTotal: 3, capacity: null })).toContain("pessoas");
    expect(validateVenueItem("restaurant", { name: "M", photos: [], price: 1, available: true })).toContain("nome");
    expect(validateVenueItem("restaurant", { name: "Muamba", photos: [], price: NaN, available: true })).toContain("preço");
    expect(validateVenueItem("warehouse", { name: "Arroz", photos: Array(7).fill("x"), price: 1, available: true })).toContain("6 fotografias");
    expect(validateVenueItem("warehouse", { name: "Arroz", photos: [], price: 1, available: true, minQty: 0 })).toContain("mínima");
  });
  it("reserva de quarto", () => {
    const base: VenueReserveInput = { kind: "stay", method: "at_place", name: "Ana", lines: [{ item: room, qty: 1 }], checkIn: "2026-10-20", checkOut: "2026-10-22", guests: 2 };
    expect(validateVenueReserve(hotelInfo, base, "2026-10-16")).toBeNull();
    expect(validateVenueReserve(hotelInfo, { ...base, checkIn: "2026-10-10" }, "2026-10-16")).toContain("já passou");
    expect(validateVenueReserve(hotelInfo, { ...base, checkOut: "2026-10-20" }, "2026-10-16")).toContain("depois da entrada");
    expect(validateVenueReserve(hotelInfo, { ...base, guests: 3 }, "2026-10-16")).toContain("pessoas a mais");
    expect(validateVenueReserve(hotelInfo, { ...base, lines: [{ item: room, qty: 3 }] }, "2026-10-16")).toContain("quartos livres");
    expect(validateVenueReserve(hotelInfo, { ...base, method: "prepaid" }, "2026-10-16")).toContain("não aceita pagamento adiantado");
    expect(validateVenueReserve(hotelInfo, { ...base, kind: "table" }, "2026-10-16")).toContain("não existe");
    expect(validateVenueReserve(hotelInfo, { ...base, name: " " }, "2026-10-16")).toContain("nome");
  });
  it("mesa e encomenda", () => {
    const now = Date.parse("2026-10-16T10:00:00Z");
    const rest = { kind: "restaurant" as const, accepts_pay_at_place: true, accepts_prepay: true };
    expect(validateVenueReserve(rest, { kind: "table", method: "at_place", name: "Ana", lines: [], guests: 4, slotAt: "2026-10-16T18:00:00Z" }, "2026-10-16", now)).toBeNull();
    expect(validateVenueReserve(rest, { kind: "table", method: "at_place", name: "Ana", lines: [], guests: 4, slotAt: "2026-10-15T18:00:00Z" }, "2026-10-16", now)).toContain("já passaram");
    expect(validateVenueReserve(rest, { kind: "table", method: "prepaid", name: "Ana", lines: [], guests: 4, slotAt: "2026-10-16T18:00:00Z" }, "2026-10-16", now)).toContain("Pagar no local");
    expect(validateVenueReserve(rest, { kind: "order", method: "at_place", name: "Ana", lines: [], slotAt: "2026-10-16T18:00:00Z" }, "2026-10-16", now)).toContain("pelo menos um");
    const wh = { kind: "warehouse" as const, accepts_pay_at_place: true, accepts_prepay: true };
    expect(validateVenueReserve(wh, { kind: "order", method: "prepaid", name: "Ana", lines: [{ item: rice, qty: 5 }], slotAt: "2026-10-17T09:00:00Z" }, "2026-10-16", now)).toContain("mínimo é 10 saco");
    expect(validateVenueReserve(wh, { kind: "order", method: "prepaid", name: "Ana", lines: [{ item: rice, qty: 200 }], slotAt: "2026-10-17T09:00:00Z" }, "2026-10-16", now)).toContain("só há 100");
    expect(validateVenueReserve(wh, { kind: "order", method: "prepaid", name: "Ana", lines: [{ item: rice, qty: 20 }], slotAt: null }, "2026-10-16", now)).toContain("levantar");
    expect(validateVenueReserve(wh, { kind: "order", method: "prepaid", name: "Ana", lines: [{ item: { ...rice, available: false }, qty: 20 }], slotAt: "2026-10-17T09:00:00Z" }, "2026-10-16", now)).toContain("já não está disponível");
  });
});

describe("reservas: servidor", () => {
  it("chama as funções certas", async () => {
    const c = rpc({ id: "o1" });
    await reserveVenue(c, "v1", { kind: "stay", method: "at_place", name: " Ana ", lines: [{ item: room, qty: 1 }], checkIn: "2026-10-20", checkOut: "2026-10-22", guests: 2, slotAt: "x" });
    expect(c.rpc).toHaveBeenCalledWith("reserve_venue", { p_venue_id: "v1", p_kind: "stay", p_lines: [{ item_id: "r1", qty: 1 }], p_method: "at_place", p_name: "Ana",
      p_phone: null, p_check_in: "2026-10-20", p_check_out: "2026-10-22", p_guests: 2, p_slot_at: null, p_note: null });
    expect((await submitVenuePayment(c, "o1", { method: "bank_transfer", reference: "12", proofPath: "u/p.jpg" })).error?.message).toContain("referência");
    expect((await submitVenuePayment(c, "o1", { method: "bank_transfer", reference: "REF1234", proofPath: null })).error?.message).toContain("comprovativo");
    await submitVenuePayment(c, "o1", { method: "bank_transfer", reference: " REF1234 ", proofPath: "u/p.jpg", proofHash: "ab" });
    expect(c.rpc).toHaveBeenLastCalledWith("submit_venue_payment", { p_order_id: "o1", p_method: "bank_transfer", p_reference: "REF1234", p_proof_path: "u/p.jpg", p_proof_hash: "ab" });
    expect((await decideVenuePayment(c, "o1", false)).error?.message).toContain("motivo");
    expect((await setVenueStatus(c, "v1", "suspended")).error?.message).toContain("motivo");
    expect((await submitVenueFee(c, "v1", { method: "cash" })).error?.message).toContain("referência");
    expect((await decideVenueFee(c, "p1", false)).error?.message).toContain("motivo");
    const k = rpc({ result: "ok", total: "42000", lines: [{ name: "Quarto", qty: "1", unit: null }] });
    const done = await completeVenueOrder(k, "v1", "rv abc234");
    expect(k.rpc).toHaveBeenCalledWith("complete_venue_order", { p_venue_id: "v1", p_code: "RV-ABC234" });
    expect(done.data?.total).toBe(42000); expect(done.data?.lines?.[0].qty).toBe(1);
  });
  it("converte números vindos da base de dados", async () => {
    const d = await venueDetail(rpc({ client_fee_pct: "5", business_fee_pct: "5", items: [{ id: "i", price: "100", qty_total: "3", min_qty: "1", free: "2", photos: null }] }), "v1", "2026-10-20", "2026-10-21");
    expect(d.data?.items[0]).toMatchObject({ price: 100, qty_total: 3, free: 2, photos: [] });
    const v = await venueOrderByToken(rpc({ result: "ok", role: "other", total: null }), "t"); expect(v.data?.total).toBeUndefined();
    const p = await venuePanel(rpc({ fee_due: "4000", fee_total: "4000", completed_total: "42000", client_fee_pct: 5, business_fee_pct: 5, payments: [{ amount: "4000" }],
      orders: [{ total: "42000", subtotal: "40000", client_fee: "2000", business_fee: "2000", lines: [{ qty: "1" }] }] }), "v1");
    expect(p.data?.fee_due).toBe(4000); expect(p.data?.orders[0].total).toBe(42000); expect(p.data?.payments[0].amount).toBe(4000);
    const m = await myVenueOrders(rpc([{ total: "10", subtotal: "9", client_fee: "1", client_fee_pct: "5", lines: null }])); expect(m.data[0].lines).toEqual([]);
    const f = await venueFeed(rpc([{ price_from: "500", rooms_free: null }]), "restaurant"); expect(f.data[0].price_from).toBe(500);
  });
  it("grava estabelecimento, conta e itens", async () => {
    const calls: any[] = [];
    const chain = (table: string) => { const q: any = {}; for (const m of ["insert", "update", "upsert", "select", "eq", "single", "delete"]) q[m] = (...a: any[]) => { calls.push([table, m, ...a]); return q; };
      q.then = (res: any) => res(table === "venue_order_lines" ? { count: 2, data: null, error: null } : { data: { id: "v9" }, error: null }); return q; };
    const c = { from: chain } as any;
    expect((await saveVenue(c, "u1", { ...venue, acceptsPrepay: true })).error?.message).toContain("IBAN");
    const r = await saveVenue(c, "u1", { ...venue, acceptsPrepay: true, pay: { holder: "Hotel Lda", iban: "AO06 0000", express: "", note: "" } });
    expect(r.data?.id).toBe("v9");
    expect(calls.find(x => x[0] === "venues" && x[1] === "insert")[2]).toMatchObject({ owner_id: "u1", business_id: "b1", kind: "hotel", subtype: "resort" });
    expect(calls.find(x => x[0] === "venue_pay" && x[1] === "upsert")[2]).toMatchObject({ venue_id: "v9", iban: "AO060000" });
    await saveVenueItem(c, "v9", "warehouse", { name: "Arroz", photos: [], price: 15000, available: true, qtyTotal: 100, minQty: 10, capacity: 5 });
    expect(calls.find(x => x[0] === "venue_items" && x[1] === "insert")[2]).toMatchObject({ venue_id: "v9", min_qty: 10, capacity: null, qty_total: 100 });
    await deleteVenueItem(c, "i1");
    expect(calls.some(x => x[0] === "venue_items" && x[1] === "update" && x[2].available === false)).toBe(true);
    expect(calls.some(x => x[0] === "venue_items" && x[1] === "delete")).toBe(false);
  });
});
