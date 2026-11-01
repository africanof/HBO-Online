import { describe, expect, it } from "vitest";
import { forwardTeamRequest, declineTeamRequest, teamRequestState, listTeamRequests } from "./team-requests";

function fake(data: unknown = null) {
  const calls: { f: string; a: any }[] = [];
  return { calls, client: { rpc: (f: string, a: any) => { calls.push({ f, a }); return Promise.resolve({ data, error: null }); } } as any };
}

describe("Pedidos mediados pela equipa", () => {
  it("reencaminha com ou sem os contactos do comprador", async () => {
    const { client, calls } = fake();
    await forwardTeamRequest(client, "fuel_orders", "f1", "  Chega às 10h ", true);
    await forwardTeamRequest(client, "orders", "o1");
    expect(calls[0]).toEqual({ f: "team_forward_request", a: { p_kind: "fuel_orders", p_id: "f1", p_note: "Chega às 10h", p_share_contact: true } });
    expect(calls[1].a).toMatchObject({ p_note: null, p_share_contact: false });
  });
  it("recusar exige motivo", async () => {
    const { client, calls } = fake();
    expect((await declineTeamRequest(client, "orders", "o1", "  ")).error).toBeTruthy();
    expect(calls).toHaveLength(0);
    await declineTeamRequest(client, "orders", "o1", "Sem stock");
    expect(calls[0].a).toEqual({ p_kind: "orders", p_id: "o1", p_reason: "Sem stock" });
  });
  it("estado e números", async () => {
    expect(teamRequestState({ forwarded_at: null, declined_at: null })).toBe("pending");
    expect(teamRequestState({ forwarded_at: "x", declined_at: null })).toBe("forwarded");
    expect(teamRequestState({ forwarded_at: null, declined_at: "x" })).toBe("declined");
    const { client } = fake([{ kind: "orders", id: "o1", amount: "1500", ref_no: "1001", delivery_lat: null }]);
    expect((await listTeamRequests(client)).data[0]).toMatchObject({ amount: 1500, ref_no: 1001, delivery_lat: null });
  });
});

import { listMyTeamRequestStates, teamRequestTarget } from "./team-requests";
describe("Estado dos pedidos para o cliente", () => {
  it("lê os pedidos à espera e tira o prefixo do título", async () => {
    const client = { rpc: () => Promise.resolve({ data: [{ kind: "fuel_orders", id: "f1", amount: "6000", ref_no: null, state: "pending" }], error: null }) } as any;
    expect((await listMyTeamRequestStates(client)).data[0]).toMatchObject({ amount: 6000, state: "pending" });
    expect(teamRequestTarget("Posto: Sonangol Cidade Alta")).toBe("Sonangol Cidade Alta");
    expect(teamRequestTarget("Encomenda da Loja")).toBe("");
  });
});
