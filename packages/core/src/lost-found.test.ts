import { describe, expect, it } from "vitest";
import { validateLostFound, isoToDmy, dmyToIso, dayBefore, lostFoundRef, lostFoundMessage, todayIso, LOST_FOUND_DICT, LOST_FOUND_CATEGORIES, LOST_FOUND_ICONS, LOST_FOUND_COLUMNS, type LostFoundInput } from "./lost-found";
import { LANGS } from "./i18n";
import { getNotificationLink } from "./notifications";

describe("perdidos e achados", () => {
  const today = "2026-11-12";
  const ok: LostFoundInput = { kind: "lost", category: "documentos", title: "BI em nome de João", place: "Mercado do Kapango", happenedOn: "2026-11-10", phone: "923 456 789" };
  it("valida o aviso", () => {
    expect(validateLostFound(ok, today)).toBeNull();
    expect(validateLostFound({ ...ok, title: "ab" }, today)).toBe("lf.err_title");
    expect(validateLostFound({ ...ok, place: " " }, today)).toBe("lf.err_place");
    expect(validateLostFound({ ...ok, happenedOn: "2026-11-13" }, today)).toBe("lf.err_date");
    expect(validateLostFound({ ...ok, happenedOn: "2025-11-11" }, today)).toBe("lf.err_date");
    expect(validateLostFound({ ...ok, happenedOn: "2025-11-12" }, today)).toBeNull();
    expect(validateLostFound({ ...ok, phone: "123" }, today)).toBe("lf.err_phone");
    expect(validateLostFound({ ...ok, photos: ["a", "b", "c", "d", "e"] }, today)).toBe("lf.err_photos");
    expect(validateLostFound({ ...ok, reward: -1 }, today)).toBe("lf.err_reward");
    expect(validateLostFound({ ...ok, category: "x" as any }, today)).toBe("lf.err_category");
  });
  it("data de hoje no fuso de Angola", () => {
    expect(todayIso(new Date("2026-11-12T23:30:00Z"))).toBe("2026-11-13");
    expect(todayIso(new Date("2026-11-12T10:00:00Z"))).toBe("2026-11-12");
  });
  it("datas DD/MM/AAAA", () => {
    expect(isoToDmy("2026-11-02")).toBe("02/11/2026");
    expect(dmyToIso("2/11/2026")).toBe("2026-11-02");
    expect(dmyToIso("31/02/2026")).toBe("");
    expect(dmyToIso("ontem")).toBe("");
    expect(dayBefore("2026-03-01")).toBe("2026-02-28");
  });
  it("o telefone não é lido com os avisos", () => {
    expect(LOST_FOUND_COLUMNS.split(",")).not.toContain("phone");
  });
  it("referência, mensagem e aviso de notificação", () => {
    expect(lostFoundRef(12)).toBe("PA-12");
    const t = (k: string, v?: Record<string, string | number>) => k + JSON.stringify(v);
    expect(lostFoundMessage({ kind: "lost", title: "Chaves", ref_no: 3 }, t)).toBe('lf.msg_lost{"title":"Chaves","ref":"PA-3"}');
    const id = "3f1c2b4a-1d2e-4f5a-8b9c-0d1e2f3a4b5c";
    expect(getNotificationLink({ type: "system", title: "", data: { for: "lost_found", lost_found_id: id } } as any)?.href).toBe("/perdidos-achados?aviso=" + id);
  });
  it("todos os textos em todas as línguas", () => {
    for (const [k, v] of Object.entries(LOST_FOUND_DICT)) for (const l of LANGS) expect(v[l], k + " " + l).toBeTruthy();
    for (const c of LOST_FOUND_CATEGORIES) { expect(LOST_FOUND_DICT["lf.c." + c]).toBeTruthy(); expect(LOST_FOUND_ICONS[c]).toBeTruthy(); }
  });
});
