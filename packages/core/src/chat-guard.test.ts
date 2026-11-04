import { describe, expect, it } from "vitest";
import { chatBlockReasonKey, CHAT_GUARD_DICT } from "./chat-guard";
import { friendlyErrorIn } from "./i18n-core";
import { LANGS } from "./i18n";

describe("bloqueio de contactos nas mensagens", () => {
  it("motivos da base de dados e da IA têm texto", () => {
    for (const r of ["phone", "email", "link", "app", "handle", "bank", "number", "split", "ai_phone", "ai_social", "ai_offplatform", "ai_x", null])
      expect(CHAT_GUARD_DICT[chatBlockReasonKey(r)], String(r)).toBeTruthy();
    expect(chatBlockReasonKey("ai_bank")).toBe("cg.r.bank");
  });
  it("todos os textos em todas as línguas", () => {
    for (const [k, v] of Object.entries(CHAT_GUARD_DICT)) for (const l of LANGS) expect(v[l], k + " " + l).toBeTruthy();
  });
  it("erros explicados ao utilizador", () => {
    expect(friendlyErrorIn(new Error("CONTACT_BLOCKED"), "pt")).toMatch(/não é permitido partilhar/);
    expect(friendlyErrorIn(new Error("CHAT_SUSPENDED"), "en")).toMatch(/24 hours/);
  });
});
