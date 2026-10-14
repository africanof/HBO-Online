import { describe, expect, it, vi } from "vitest";
import { fuelQuantityText, fuelPriceText, minutesAgoText, fuelIsStale, fuelStatusLine, fuelReportsText, normalizeFuelCode, fuelShareMessage, validateStation,
  validateFuelReserve, stationRef, fuelOrderRef, fuelFeed, reserveFuel, submitFuelPayment, decideFuelPayment, collectFuel, setStationStatus, submitFuelFee,
  updateFuelProduct, saveStation, FUEL_STATUS_LABELS, FUEL_COLLECT_LABELS, type StationInput } from "./fuel";
import { friendlyError } from "./classified-listings";
import { getNotificationLink } from "./notifications";
import { HOME_CATEGORIES } from "./design";

const now = Date.parse("2026-10-14T10:00:00Z");
const station: StationInput = { name: "Posto Kapango", kind: "both", municipalityId: "m1", acceptsReservations: true, acceptsPrepay: false, holdMinutes: 120,
  pay: { holder: "", iban: "", express: "", note: "" }, products: ["gasolina", "gas_12kg"] };
const rpc = (data: unknown = null) => ({ rpc: vi.fn().mockResolvedValue({ data, error: null }) }) as any;

describe("combustível e gás", () => {
  it("textos", () => {
    expect(fuelQuantityText("gasolina", 20)).toBe("20 L"); expect(fuelQuantityText("gasolina", 12.5)).toBe("12,5 L");
    expect(fuelQuantityText("gas_12kg", 1)).toBe("1 botija"); expect(fuelQuantityText("gas_12kg", 2)).toBe("2 botijas");
    expect(fuelPriceText("gasolina", 300)).toBe("300 Kz / litro"); expect(fuelPriceText("gas_6kg", null)).toBe("Preço por indicar");
    expect(minutesAgoText("2026-10-14T09:35:00Z", now)).toBe("há 25 min"); expect(minutesAgoText("2026-10-14T06:00:00Z", now)).toBe("há 4 h");
    expect(fuelIsStale("2026-10-14T03:00:00Z", now)).toBe(true); expect(fuelIsStale("2026-10-14T09:00:00Z", now)).toBe(false);
    expect(fuelStatusLine({ status: "available", status_at: "2026-10-14T09:50:00Z", queue: "long" }, now)).toBe("🟢 Há · atualizado há 10 min · Fila grande");
    expect(fuelStatusLine({ status: "unknown", status_at: "2026-10-14T09:50:00Z", queue: null }, now)).toBe(FUEL_STATUS_LABELS.unknown);
    expect(fuelReportsText(3, 1)).toBe("3 pessoas confirmaram que há · 1 disse que acabou (últimas 2 h)"); expect(fuelReportsText(0, 0)).toBe("");
    expect(normalizeFuelCode("cb abc234")).toBe("CB-ABC234"); expect(normalizeFuelCode("abc234")).toBe("CB-ABC234");
    expect(stationRef(1001)).toBe("S-1001"); expect(fuelOrderRef(1002)).toBe("C-1002");
    expect(fuelShareMessage("https://h.ao/", { station_id: "s1", station_name: "Posto Kapango", product: "gasolina", status: "available", price: 300, municipality_name: "Huambo" }))
      .toBe("⛽ 🟢 Há gasolina — Posto Kapango, Huambo\n💰 300 Kz / litro\n👉 https://h.ao/combustivel/s1");
    expect(FUEL_COLLECT_LABELS.used).toContain("JÁ FOI USADO");
    expect(HOME_CATEGORIES.some(c => c.href === "/combustivel")).toBe(true);
  });
  it("validação", () => {
    expect(validateStation(station)).toBeNull();
    expect(validateStation({ ...station, name: "P" })).toContain("nome");
    expect(validateStation({ ...station, municipalityId: "" })).toContain("município");
    expect(validateStation({ ...station, products: [] })).toContain("produto");
    expect(validateStation({ ...station, kind: "fuel" })).toContain("gás");
    expect(validateStation({ ...station, kind: "gas", products: ["gasolina"] })).toContain("combustível");
    expect(validateStation({ ...station, acceptsPrepay: true })).toContain("IBAN");
    expect(validateStation({ ...station, holdMinutes: 5 })).toContain("15 minutos");
    const r = { product: "gas_12kg" as const, max_per_order: 2, reservable_left: 5 };
    expect(validateFuelReserve(r, 1, "Ana")).toBeNull();
    expect(validateFuelReserve(r, 1.5, "Ana")).toContain("botijas");
    expect(validateFuelReserve(r, 3, "Ana")).toContain("2 botijas");
    expect(validateFuelReserve({ ...r, product: "gasolina", max_per_order: 40, reservable_left: 10 }, 20, "Ana")).toContain("10 L");
    expect(validateFuelReserve(r, 1, " ")).toContain("nome");
  });
  it("erros e avisos", () => {
    expect(friendlyError({ message: "FUEL_ORDER_OPEN" })).toContain("reserva ativa");
    expect(friendlyError({ message: "FUEL_NOT_AVAILABLE" })).toContain("Avisar-me");
    const id = "11111111-1111-4111-8111-111111111111";
    expect(getNotificationLink({ data: { for: "fuel", station_id: id }, type: "system", title: "x" } as any)?.href).toBe("/combustivel/" + id);
    expect(getNotificationLink({ data: { for: "fuel_orders" }, type: "system", title: "x" } as any)?.href).toBe("/combustivel/pedidos");
    expect(getNotificationLink({ data: { for: "fuel_station", station_id: id }, type: "system", title: "x" } as any)?.href).toBe("/combustivel/" + id + "/gerir");
    expect(getNotificationLink({ data: { fuel_station_id: id }, type: "system", title: "x" } as any)?.href).toBe("/admin");
  });
  it("chamadas ao servidor", async () => {
    const f = rpc([{ product_id: "p", price: "300", reservable_left: "80", max_per_order: "40", yes_2h: "2", no_2h: "0" }]);
    const rows = (await fuelFeed(f, { product: "gasolina" })).data;
    expect(rows[0]).toMatchObject({ price: 300, reservable_left: 80, yes_2h: 2 });
    expect(f.rpc).toHaveBeenCalledWith("fuel_feed", { p_product: "gasolina", p_municipality: null, p_station: null, p_limit: 200 });
    const c = rpc();
    await reserveFuel(c, "p", 20, "at_station", " Ana ", " 923 ", " ld-12 ");
    expect(c.rpc).toHaveBeenLastCalledWith("reserve_fuel", { p_product_id: "p", p_quantity: 20, p_method: "at_station", p_name: "Ana", p_phone: "923", p_plate: "ld-12" });
    expect((await submitFuelPayment(c, "o", "multicaixa_express", "1")).error?.message).toContain("referência");
    expect((await decideFuelPayment(c, "o", false)).error?.message).toContain("motivo");
    expect((await setStationStatus(c, "s", "suspended")).error?.message).toContain("motivo");
    expect((await submitFuelFee(c, "s", { method: "cash" })).error?.message).toContain("referência");
    const k = rpc({ result: "ok", code: "CB-ABC234" });
    expect((await collectFuel(k, "s", "abc234")).data?.result).toBe("ok");
    expect(k.rpc).toHaveBeenCalledWith("collect_fuel", { p_station_id: "s", p_code: "CB-ABC234" });
    expect((await updateFuelProduct(c, "p", { price: -1 })).error?.message).toContain("Preço");
  });
  it("gravar o posto: produtos novos e tirados (sem perder pedidos)", async () => {
    const calls: [string, string, any][] = [];
    const chain = (table: string) => ({
      insert: (row: any) => { calls.push([table, "insert", row]); return { select: () => ({ single: async () => ({ data: { id: "s1" }, error: null }) }), then: (f: any) => f({ error: null }) }; },
      update: (row: any) => { calls.push([table, "update", row]); return { eq: () => ({ select: () => ({ single: async () => ({ data: { id: "s1" }, error: null }) }), then: (f: any) => f({ error: null }) }) }; },
      upsert: async (row: any) => { calls.push([table, "upsert", row]); return { error: null }; },
      delete: () => ({ eq: async (_: string, id: string) => { calls.push([table, "delete", id]); return { error: null }; } }),
      select: () => ({ eq: async (_: string, id: string) => ({ count: id === "old-with-orders" ? 3 : 0 }) })
    });
    const client = { from: (t: string) => chain(t) } as any;
    const existing: any[] = [{ id: "old-with-orders", product: "gasoleo" }, { id: "old-empty", product: "petroleo" }, { id: "keep", product: "gasolina" }];
    const r = await saveStation(client, "u", station, "s1", existing);
    expect(r.error).toBeNull();
    expect(calls).toEqual(expect.arrayContaining([
      ["fuel_products", "insert", expect.objectContaining({ product: "gas_12kg", max_per_order: 2 })],
      ["fuel_products", "update", { status: "unknown", reservable_qty: 0 }],
      ["fuel_products", "delete", "old-empty"]]));
    expect(calls.some(c => c[1] === "insert" && c[2].product === "gasolina")).toBe(false);
  });
});
