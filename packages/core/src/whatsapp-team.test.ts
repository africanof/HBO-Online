import { describe, expect, it } from "vitest";
import { formatWaId, WHATSAPP_DICT, WHATSAPP_AREAS } from "./whatsapp";

describe("whatsapp da equipa", () => {
  it("mostra o número de forma legível", () => {
    expect(formatWaId("244923456789")).toBe("+244 923 456 789");
    expect(formatWaId("351912345678")).toBe("+351912345678");
  });
  it("tem textos para todas as áreas, nas 4 línguas", () => {
    for (const a of WHATSAPP_AREAS) expect(WHATSAPP_DICT["wa.area." + a]).toBeTruthy();
    for (const v of Object.values(WHATSAPP_DICT)) { expect(v.en && v.zh && v.fr && v.pt).toBeTruthy(); }
  });
});
