import { describe, expect, it, vi } from "vitest";
import { formatEventDate, localInputToIso, isoToLocalInput, eventIsOver, eventRef, ticketOrderRef, priceFromText, ticketsLeftText, eventShareMessage,
  normalizeTicketCode, qrMatrix, qrSvgPath, validateEvent, reserveTickets, submitTicketPayment, decideTicketOrder, checkInTicket, listEvents, saveEvent,
  cancelEvent, ticketUsable, partsToLocalInput, localInputToParts, TICKET_METHOD_LABELS, submitEventPlatformPayment, decideEventPayment, CHECKIN_LABELS, EVENT_CATEGORY_LABELS, type EventInput } from "./events";
import { friendlyError } from "./classified-listings";
import { getNotificationLink } from "./notifications";

const future = "2099-10-18T20:00";
const base: EventInput = { title: "Concerto de Kizomba", category: "music", startsAt: future, venue: "Cine Ruacaná",
  pay: { holder: "Organizador", iban: "", express: "923000000", note: "" }, tickets: [{ name: "Normal", price: "5 000", quantity: "100" }] };
const rpcClient = (data: unknown = null) => ({ rpc: vi.fn().mockResolvedValue({ data, error: null }) }) as any;

describe("eventos e bilhetes", () => {
  it("datas em hora de Angola", () => {
    expect(localInputToIso("2026-10-18T20:00")).toBe("2026-10-18T19:00:00.000Z");
    expect(localInputToIso("18/10/2026")).toBeNull();
    expect(isoToLocalInput("2026-10-18T19:00:00.000Z")).toBe("2026-10-18T20:00");
    expect(isoToLocalInput(null)).toBe("");
    expect(partsToLocalInput("18/10/2026", "20:00")).toBe("2026-10-18T20:00");
    expect(partsToLocalInput("8-1-2027", "9h30")).toBe("2027-01-08T09:30");
    expect(partsToLocalInput("31/02/2027", "20:00")).toBe("");
    expect(partsToLocalInput("18/10/2026", "25:00")).toBe("");
    expect(localInputToParts("2026-10-18T20:00")).toEqual({ date: "18/10/2026", time: "20:00" });
    expect(localInputToParts("")).toEqual({ date: "", time: "" });
    expect(formatEventDate("2026-10-18T19:00:00.000Z")).toBe("dom, 18/10/2026 · 20:00");
    expect(eventIsOver({ starts_at: "2026-10-18T19:00:00Z", ends_at: null }, Date.parse("2026-10-19T02:00:00Z"))).toBe(true);
    expect(eventIsOver({ starts_at: "2026-10-18T19:00:00Z", ends_at: "2026-10-19T05:00:00Z" }, Date.parse("2026-10-19T02:00:00Z"))).toBe(false);
  });
  it("textos", () => {
    expect(eventRef(1001)).toBe("E-1001"); expect(ticketOrderRef(1002)).toBe("B-1002");
    expect(priceFromText(0)).toBe("Grátis"); expect(priceFromText("5000")).toBe("Desde 5 000 Kz"); expect(priceFromText(null)).toBe("Sem bilhetes");
    expect(ticketsLeftText(0)).toBe("Esgotado"); expect(ticketsLeftText(1)).toBe("Últimos 1 bilhete"); expect(ticketsLeftText(7)).toBe("Últimos 7 bilhetes"); expect(ticketsLeftText(120)).toBe("120 bilhetes disponíveis");
    expect(eventShareMessage("https://huambo.ao/", { id: "e1", title: "Festa", starts_at: "2026-10-18T19:00:00Z", venue: "Cine Ruacaná" }, 0))
      .toBe("🎟️ Festa\n📅 dom, 18/10/2026 · 20:00\n📍 Cine Ruacaná\n💰 Grátis\n👉 https://huambo.ao/eventos/e1");
    expect(EVENT_CATEGORY_LABELS.music).toContain("Música");
    expect(TICKET_METHOD_LABELS.cash).toBe("Em mão ao organizador");
    const o = { status: "confirmed" as const, event_status: "published" as const, starts_at: "2026-10-18T19:00:00Z", ends_at: null };
    expect(ticketUsable(o, Date.parse("2026-10-18T20:00:00Z"))).toBe(true);
    expect(ticketUsable({ ...o, event_status: "cancelled" }, Date.parse("2026-10-18T20:00:00Z"))).toBe(false);
    expect(ticketUsable(o, Date.parse("2026-10-20T20:00:00Z"))).toBe(false);
    expect(CHECKIN_LABELS.used).toContain("JÁ ENTROU");
  });
  it("códigos e QR", () => {
    expect(normalizeTicketCode("ho-abcd-efgh")).toBe("HO-ABCD-EFGH");
    expect(normalizeTicketCode("abcdefgh")).toBe("HO-ABCD-EFGH");
    const m = qrMatrix("HO-ABCD-EFGH");
    expect(m.length).toBeGreaterThanOrEqual(21); expect(m[0][0]).toBe(true); // canto do QR é preto
    const svg = qrSvgPath("HO-ABCD-EFGH"); expect(svg.size).toBe(m.length); expect(svg.d.startsWith("M0 0h1v1h-1z")).toBe(true);
  });
  it("validação do evento", () => {
    expect(validateEvent(base)).toBeNull();
    expect(validateEvent({ ...base, title: "Ok" })).toBe("Escreva o nome do evento.");
    expect(validateEvent({ ...base, startsAt: "2020-01-01T10:00" })).toBe("O evento tem de ser no futuro.");
    expect(validateEvent({ ...base, endsAt: "2099-10-18T19:00" })).toBe("O fim tem de ser depois do início.");
    expect(validateEvent({ ...base, tickets: [] })).toContain("pelo menos um tipo de bilhete");
    expect(validateEvent({ ...base, tickets: [{ name: "N", price: "0", quantity: "1" }] })).toContain("Bilhete 1: escreva o nome");
    expect(validateEvent({ ...base, tickets: [{ name: "Normal", price: "0", quantity: "0" }] })).toContain("quantos bilhetes");
    expect(validateEvent({ ...base, pay: { holder: "", iban: "", express: "", note: "" } })).toContain("IBAN ou o número Multicaixa Express");
    expect(validateEvent({ ...base, tickets: [{ name: "Entrada livre", price: "0", quantity: "50" }], pay: { holder: "", iban: "", express: "", note: "" } })).toBeNull();
  });
  it("erros e avisos", () => {
    expect(friendlyError({ message: "NOT_ENOUGH_TICKETS" })).toContain("Já não há bilhetes suficientes");
    expect(friendlyError({ message: "EVENT_NEEDS_PAYMENT_INFO" })).toContain("IBAN");
    expect(friendlyError({ message: "REFERENCE_REQUIRED" })).toContain("referência");
    expect(getNotificationLink({ data: { for: "tickets" }, type: "system", title: "x" } as any)?.href).toBe("/bilhetes");
    expect(getNotificationLink({ data: { for: "event_orders", event_id: "11111111-1111-4111-8111-111111111111" }, type: "system", title: "x" } as any)?.href).toBe("/eventos/11111111-1111-4111-8111-111111111111/gerir");
  });
  it("chamadas ao servidor", async () => {
    const c = rpcClient();
    expect((await reserveTickets(c, "t", 0, "Ana")).error?.message).toContain("quantos bilhetes");
    expect((await reserveTickets(c, "t", 1, " ")).error?.message).toContain("nome");
    await reserveTickets(c, "t", 2, " Ana ", " 923 ");
    expect(c.rpc).toHaveBeenLastCalledWith("reserve_event_tickets", { p_ticket_type_id: "t", p_quantity: 2, p_name: "Ana", p_phone: "923" });
    expect((await submitTicketPayment(c, "o", "multicaixa_express", "1")).error?.message).toContain("referência");
    expect((await decideTicketOrder(c, "o", false)).error?.message).toContain("motivo");
    expect((await cancelEvent(c, "e", " ")).error?.message).toContain("motivo");
    expect((await submitEventPlatformPayment(c, "e", "boost", { method: "bank_transfer" })).error?.message).toContain("referência");
    expect((await decideEventPayment(c, "p", false)).error?.message).toBe("Escreva o motivo.");
    const k = rpcClient({ result: "ok", code: "HO-ABCD-EFGH", type: "VIP", holder: "Ana" });
    expect((await checkInTicket(k, "e", "abcdefgh")).data?.result).toBe("ok");
    const l = rpcClient([{ id: "e1", price_from: "5000", tickets_left: "40" }]);
    expect((await listEvents(l, { category: "music", query: " kizomba " })).data[0]).toMatchObject({ price_from: 5000, tickets_left: 40 });
    expect(l.rpc).toHaveBeenCalledWith("list_events", { p_category: "music", p_municipality: null, p_query: "kizomba", p_limit: 60 });
  });
  it("gravar: evento, pagamento e bilhetes", async () => {
    const calls: [string, string, any][] = [];
    const chain = (table: string) => ({
      insert: (row: any) => { calls.push([table, "insert", row]); return { select: () => ({ single: async () => ({ data: { id: "e1" }, error: null }) }), then: (f: any) => f({ error: null }) }; },
      update: (row: any) => { calls.push([table, "update", row]); return { eq: () => ({ select: () => ({ single: async () => ({ data: { id: "e1" }, error: null }) }), then: (f: any) => f({ error: null }) }) }; },
      upsert: async (row: any) => { calls.push([table, "upsert", row]); return { error: null }; },
      delete: () => ({ eq: async () => { calls.push([table, "delete", null]); return { error: null }; } })
    });
    const client = { from: (t: string) => chain(t) } as any;
    const r = await saveEvent(client, "u", { ...base, tickets: [{ name: "Normal", price: "5 000", quantity: "100" }, { id: "t2", name: "VIP", price: "15000", quantity: "20" }] }, undefined, [{ id: "t2" }, { id: "t3" }]);
    expect(r.error).toBeNull();
    expect(calls[0]).toEqual(["events", "insert", expect.objectContaining({ organizer_id: "u", title: "Concerto de Kizomba", starts_at: "2099-10-18T19:00:00.000Z" })]);
    expect(calls[1]).toEqual(["event_payment_info", "upsert", expect.objectContaining({ event_id: "e1", express: "923000000" })]);
    expect(calls[2]).toEqual(["event_ticket_types", "insert", expect.objectContaining({ name: "Normal", price: 5000, quantity: 100, event_id: "e1", sort: 0 })]);
    expect(calls[3]).toEqual(["event_ticket_types", "update", expect.objectContaining({ name: "VIP", price: 15000, sort: 1 })]);
    expect(calls[4]).toEqual(["event_ticket_types", "delete", null]);
  });
});
