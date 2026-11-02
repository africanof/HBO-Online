import { describe, expect, it, vi } from "vitest";
import { parseMunicipalityNames, addMunicipalities, setProvinceActive, friendlyError } from "./index";

describe("províncias", () => {
  it("lê os municípios colados", () => {
    expect(parseMunicipalityNames("Lobito\n Benguela ,Catumbela;;lobito\nX\n  Baía   Farta ")).toEqual(["Lobito", "Benguela", "Catumbela", "Baía Farta"]);
  });
  it("chama as funções da equipa", async () => {
    const rpc = vi.fn(async () => ({ data: 2, error: null })); const c = { rpc } as any;
    await addMunicipalities(c, "p1", "Lobito\nBenguela");
    expect(rpc).toHaveBeenLastCalledWith("admin_add_municipalities", { p_province_id: "p1", p_names: ["Lobito", "Benguela"] });
    await setProvinceActive(c, "p1", true);
    expect(rpc).toHaveBeenLastCalledWith("admin_set_province_active", { p_province_id: "p1", p_active: true });
  });
  it("mensagens de erro", () => {
    expect(friendlyError({ message: "PROVINCE_NEEDS_MUNICIPALITIES" })).toMatch(/municípios/);
    expect(friendlyError({ message: "MUNICIPALITY_IN_USE" })).toMatch(/não pode ser apagado/);
  });
});
