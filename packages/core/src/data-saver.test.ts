import { describe, expect, it } from "vitest";
import { readDataSaverMode, resolveDataSaver, savedText, DATA_SAVER_OPTIONS } from "./index";

describe("poupar dados", () => {
  it("lê a escolha guardada", () => {
    expect(readDataSaverMode("on")).toBe("on");
    expect(readDataSaverMode("lixo")).toBe("auto");
    expect(readDataSaverMode(null, "off")).toBe("off");
    expect(DATA_SAVER_OPTIONS.map(o => o.value)).toEqual(["auto", "on", "off"]);
  });
  it("automático segue o aparelho", () => {
    expect(resolveDataSaver("auto", true)).toBe(true);
    expect(resolveDataSaver("auto", false)).toBe(false);
    expect(resolveDataSaver("on")).toBe(true);
    expect(resolveDataSaver("off", true)).toBe(false);
  });
  it("texto do que se poupou", () => {
    expect(savedText(0)).toBe("");
    expect(savedText(1)).toBe("Poupou cerca de 150 KB (1 fotografia não carregada).");
    expect(savedText(21)).toBe("Poupou cerca de 3,1 MB (21 fotografias não carregadas).");
  });
});
