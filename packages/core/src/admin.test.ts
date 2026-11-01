import { describe, expect, it } from "vitest";
import { canModerate, canManageRoles, assignableRoles, canManageAccount, slugify, getMyAdminRole, createCategory } from "./admin";
import { friendlyError } from "./classified-listings";

describe("admin helpers", () => {
  it("checks roles", () => {
    expect(canModerate("moderator")).toBe(true);
    expect(canModerate("user")).toBe(false);
    expect(canManageRoles("moderator")).toBe(true);
    expect(canManageRoles("user")).toBe(false);
    expect(assignableRoles("moderator")).toEqual(["user", "moderator"]);
    expect(assignableRoles("admin")).toEqual(["user", "moderator", "admin"]);
    expect(assignableRoles("user")).toEqual([]);
    expect(canManageAccount("moderator", "user")).toBe(true);
    expect(canManageAccount("moderator", "moderator")).toBe(true);
    expect(canManageAccount("moderator", "admin")).toBe(false);
    expect(canManageAccount("admin", "admin")).toBe(true);
    expect(canManageAccount("user", "user")).toBe(false);
    expect(canManageRoles("admin")).toBe(true);
  });
  it("slugifies Portuguese names", () => {
    expect(slugify("Eletrónica & Telemóveis")).toBe("eletronica-telemoveis");
  });
  it("falls back to user when role lookup fails", async () => {
    const client: any = { rpc: async () => ({ data: null, error: { message: "x" } }) };
    expect(await getMyAdminRole(client)).toBe("user");
    const admin: any = { rpc: async () => ({ data: "admin", error: null }) };
    expect(await getMyAdminRole(admin)).toBe("admin");
  });
  it("requires a category name", async () => {
    const r = await createCategory({} as any, "  ", "classified");
    expect(r.error?.message).toMatch(/nome/);
  });
  it("translates admin errors", () => {
    expect(friendlyError(new Error("ADMIN_ONLY"))).toMatch(/administração/);
    expect(friendlyError(new Error("ACCOUNT_SUSPENDED"))).toMatch(/suspensa/);
  });
});
