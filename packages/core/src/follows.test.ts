import { describe, expect, it, vi } from "vitest";
import { followHref, followersText, followButtonLabel, getFollowInfo, toggleFollow, listMyFollows, getNotificationLink, friendlyError, HELP_FAQ } from "./index";

describe("seguir", () => {
  it("ligações e textos", () => {
    expect(followHref("provider", "p1")).toBe("/profissionais/p1");
    expect(followHref("business", "b1")).toBe("/empresas/b1");
    expect(followHref("seller", "s1")).toBe("/vendedor/s1");
    expect(followersText(0)).toBe("Sem seguidores");
    expect(followersText(1)).toBe("1 seguidor");
    expect(followersText(1250)).toBe("1 250 seguidores");
    expect(followButtonLabel(true)).toBe("✔ A seguir");
    expect(followButtonLabel(false)).toBe("➕ Seguir");
  });
  it("chamadas ao servidor", async () => {
    const rpc = vi.fn(async (fn: string) => ({ data: fn === "follow_info" ? { followers: "3", following: true } : fn === "toggle_follow" ? false : [], error: null }));
    const c = { rpc } as any;
    expect((await getFollowInfo(c, "business", "b1")).data).toEqual({ followers: 3, following: true });
    expect(rpc).toHaveBeenLastCalledWith("follow_info", { p_kind: "business", p_id: "b1" });
    expect((await toggleFollow(c, "seller", "s1")).data).toBe(false);
    expect(rpc).toHaveBeenLastCalledWith("toggle_follow", { p_kind: "seller", p_id: "s1" });
    await listMyFollows(c);
    expect(rpc).toHaveBeenLastCalledWith("my_follows");
    expect((await getFollowInfo({ rpc: async () => ({ data: null, error: null }) } as any, "seller", "x")).data).toEqual({ followers: 0, following: false });
  });
  it("avisos, erros e ajuda", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(getNotificationLink({ type: "system", title: "Novo produto de Zé", data: { for: "follow", product_id: id } })?.href).toBe("/loja/" + id);
    expect(getNotificationLink({ type: "system", title: "Trabalho novo", data: { for: "follow", provider_id: id } })?.href).toBe("/profissionais/" + id);
    expect(getNotificationLink({ type: "system", title: "Novidade", data: { for: "follow", business_id: id } })?.href).toBe("/empresas/" + id);
    expect(getNotificationLink({ type: "system", title: "Tem novos seguidores 👋", data: { for: "new_follower" } })?.href).toBe("/seguindo");
    expect(friendlyError(new Error("CANNOT_FOLLOW_SELF"))).toMatch(/próprio/);
    expect(HELP_FAQ.some(f => /sigo/.test(f.q))).toBe(true);
  });
});
