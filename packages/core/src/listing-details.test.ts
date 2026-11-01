import { describe, expect, it } from "vitest";
import { validateDetails, buildDetailAttributes, detailFacts, detailValuesFrom, withoutDetailKeys, detailFieldsFor } from "./listing-details";

describe("viaturas e imóveis", () => {
  it("a marca da viatura é obrigatória (a base de dados recusa sem ela)", () => {
    expect(validateDetails("vehicle", {})).toBe("attr.err.brand");
    expect(validateDetails("vehicle", { brand: "Toyota" })).toBeNull();
    expect(validateDetails("vehicle", { brand: "Toyota", year: "1800" })).toBe("attr.err.year");
    expect(validateDetails("vehicle", { brand: "Toyota", mileage: "-5" })).toBe("attr.err.mileage");
    expect(validateDetails("vehicle", { brand: "Toyota", fuel: "vento" })).toBe("attr.err.fuel");
    expect(validateDetails("classified", {})).toBeNull();
  });
  it("imóveis: área, quartos e casas de banho", () => {
    expect(validateDetails("real_estate", { area_m2: "0" })).toBe("attr.err.area_m2");
    expect(validateDetails("real_estate", { bedrooms: "2.5" })).toBe("attr.err.bedrooms");
    expect(validateDetails("real_estate", { propertyType: "casa", area_m2: "120,5", bedrooms: "3" })).toBeNull();
  });
  it("grava números como números e mostra os factos", () => {
    const a = buildDetailAttributes("vehicle", { brand: " Toyota ", year: "2015", mileage: "120 000", fuel: "gasoleo", model: "" });
    expect(a).toEqual({ brand: "Toyota", year: 2015, mileage: 120000, fuel: "gasoleo" });
    expect(detailFacts("vehicle", a).map(f => f.key)).toEqual(["brand", "year", "mileage", "fuel"]);
    expect(detailValuesFrom({ ...a, municipalityId: "m" })).toEqual({ brand: "Toyota", year: "2015", mileage: "120000", fuel: "gasoleo" });
    expect(withoutDetailKeys({ brand: "x", agro: true })).toEqual({ agro: true });
    expect(detailFieldsFor("product")).toEqual([]);
  });
});
