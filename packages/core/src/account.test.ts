import { describe, expect, it } from "vitest";
import { authErrorMessage, validateNewPassword } from "./account-security";
import { profileFromRow, validateProfileInput } from "./profile";
import { normalizeSearchFilters } from "./classified-search";

describe("auth messages", () => {
  it("translates common auth errors", () => {
    expect(authErrorMessage(new Error("Invalid login credentials"))).toBe("Email ou palavra-passe incorretos.");
    expect(authErrorMessage(new Error("Email not confirmed"))).toMatch(/Confirme/);
    expect(authErrorMessage(new Error("User already registered"))).toMatch(/Já existe/);
    expect(authErrorMessage(new TypeError("Failed to fetch"))).toMatch(/internet/);
    expect(authErrorMessage({ message: "Database error saving new user" })).toMatch(/telefone/);
  });
  it("validates new passwords", () => {
    expect(validateNewPassword("1234567", "1234567")).toMatch(/8 caracteres/);
    expect(validateNewPassword("12345678", "12345679")).toMatch(/não coincidem/);
    expect(validateNewPassword("12345678", "12345678")).toBeNull();
  });
});

describe("profile", () => {
  it("maps the real profiles columns", () => {
    expect(profileFromRow({ id: "1", full_name: "Ana", phone: null, province: null, municipality: "Caála" }))
      .toEqual({ id: "1", fullName: "Ana", phone: undefined, province: "Huambo", municipality: "Caála" });
  });
  it("validates name and phone", () => {
    expect(validateProfileInput({ fullName: " ", municipality: "" })).toBe("Indique o seu nome.");
    expect(validateProfileInput({ fullName: "Ana", phone: "abc", municipality: "" })).toMatch(/Telefone/);
    expect(validateProfileInput({ fullName: "Ana", phone: "+244 923 000 000", municipality: "" })).toBeNull();
  });
});

describe("search filters", () => {
  it("puts territory inside attributes and drops empty values", () => {
    expect(normalizeSearchFilters({ query: " casa ", provinceId: "p", municipalityId: "m", minPrice: undefined }))
      .toEqual({ query: "casa", attributes: { municipalityId: "m" } });
    expect(normalizeSearchFilters({ provinceId: "p", maxPrice: NaN })).toEqual({ attributes: { provinceId: "p" } });
  });
});

import { getPublicProfile } from "./profile";
describe("getPublicProfile", () => {
  it("calls the public profile function with the owner id", async () => {
    const calls: any[] = [];
    const client: any = { rpc: (fn: string, args: any) => { calls.push([fn, args]); return { maybeSingle: async () => ({ data: { full_name: "Ana" }, error: null }) }; } };
    const r = await getPublicProfile(client, "u1");
    expect(calls).toEqual([["get_public_profile", { p_user_id: "u1" }]]);
    expect(r.data?.full_name).toBe("Ana");
  });
});
