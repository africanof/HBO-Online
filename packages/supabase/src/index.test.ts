import { describe, expect, it } from "vitest";
import { createSupabaseClient, configureSupabase } from "./index";

describe("createSupabaseClient", () => {
  it("returns the same client for the same project (session shared between pages)", () => {
    const a = createSupabaseClient("https://abc.supabase.co", "sb_publishable_test");
    expect(createSupabaseClient(" https://abc.supabase.co ", "sb_publishable_test")).toBe(a);
  });
  it("creates a new client after configuration changes", () => {
    const a = createSupabaseClient("https://abc.supabase.co", "sb_publishable_test");
    const memory = new Map<string, string>();
    configureSupabase({ storage: { getItem: k => memory.get(k) ?? null, setItem: (k, v) => { memory.set(k, v); }, removeItem: k => { memory.delete(k); } }, detectSessionInUrl: false });
    expect(createSupabaseClient("https://abc.supabase.co", "sb_publishable_test")).not.toBe(a);
  });
  it("rejects missing configuration", () => {
    expect(() => createSupabaseClient("", "x")).toThrow(/obrigatórias/);
  });
});
