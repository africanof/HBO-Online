import { describe, expect, it } from "vitest";
import { teamForwardMessage, teamSendMessage, otherParticipant, listMediatedConversations } from "./messaging";

function fake(data: unknown = null) {
  const calls: { f: string; a: any }[] = [];
  return { calls, client: { rpc: (f: string, a: any) => { calls.push({ f, a }); return Promise.resolve({ data, error: null }); } } as any };
}

describe("Mensagens mediadas pela equipa", () => {
  it("reencaminha a mensagem para a outra parte", async () => {
    const { client, calls } = fake();
    await teamForwardMessage(client, "c1", "m1", "u2");
    expect(calls[0]).toEqual({ f: "team_send_message", a: { p_conversation_id: "c1", p_audience: "u2", p_body: null, p_forward_message_id: "m1" } });
  });
  it("não envia mensagens vazias da equipa", async () => {
    const { client, calls } = fake();
    expect((await teamSendMessage(client, "c1", null, "   ")).error).toBeTruthy();
    expect(calls).toHaveLength(0);
  });
  it("encontra a outra parte da conversa", () => {
    const c = { participants: [{ user_id: "a", name: "Ana", role: "starter" as const }, { user_id: "b", name: "Bruno", role: "owner" as const }] };
    expect(otherParticipant(c, "a")?.user_id).toBe("b");
    expect(otherParticipant(c, "b")?.user_id).toBe("a");
  });
  it("lê o número de mensagens por tratar", async () => {
    const { client } = fake([{ conversation_id: "c1", pending: "2", participants: [] }]);
    expect((await listMediatedConversations(client)).data[0].pending).toBe(2);
  });
});
