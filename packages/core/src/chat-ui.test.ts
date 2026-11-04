import { describe, expect, it } from "vitest";
import { chatListTime, chatDayLabel, groupChatMessages, initials, avatarColor } from "./chat-ui";

const now = new Date("2026-11-04T15:00:00+01:00");
describe("apresentação das mensagens", () => {
  it("hora na lista", () => {
    expect(chatListTime("2026-11-04T09:05:00+01:00", "pt", now)).toBe("09:05");
    expect(chatListTime("2026-11-03T20:00:00+01:00", "pt", now)).toBe("ontem");
    expect(chatListTime("2026-11-03T20:00:00+01:00", "en", now)).toBe("yesterday");
    expect(chatListTime("2026-10-01T10:00:00+01:00", "pt", now)).toMatch(/01.10|10.01/);
    expect(chatListTime(null, "pt", now)).toBe("");
  });
  it("separador de dias", () => {
    expect(chatDayLabel("2026-11-04T08:00:00+01:00", "pt", now)).toBe("Hoje");
    expect(chatDayLabel("2026-11-03T08:00:00+01:00", "fr", now)).toBe("Hier");
    expect(chatDayLabel("2026-11-01T08:00:00+01:00", "pt", now)).toMatch(/^Domingo/);
  });
  it("agrupa mensagens seguidas da mesma pessoa", () => {
    const m = (s: string, t: string, team = false) => ({ sender_id: s, created_at: "2026-11-04T" + t + ":00+01:00", from_team: team });
    const rows = groupChatMessages([m("a", "10:00"), m("a", "10:01"), m("b", "10:02"), m("b", "10:20"), m("a", "10:21", true)], "a");
    expect(rows.map(r => [r.mine, r.first, r.last])).toEqual([[true, true, false], [true, false, true], [false, true, true], [false, true, true], [false, true, true]]);
    expect(rows[0].newDay).toBe(true); expect(rows[1].newDay).toBe(false);
  });
  it("iniciais e cor", () => {
    expect(initials("Aires Festo")).toBe("AF"); expect(initials("nadir")).toBe("N"); expect(initials("")).toBe("?");
    expect(avatarColor("x")).toBe(avatarColor("x"));
  });
});
describe("assunto da conversa", () => {
  it("esconde o nome nas conversas com profissionais e empresas", async () => {
    const { conversationSubject } = await import("./chat-ui");
    expect(conversationSubject({ subject: "Adão Neto", context_type: "provider" })).toBeNull();
    expect(conversationSubject({ subject: "Toyota Hilux", context_type: "classified" })).toBe("Toyota Hilux");
  });
});
