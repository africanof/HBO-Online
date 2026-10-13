import { describe, expect, it, vi } from "vitest";
import { videoPlatform, embedUrl, embedHint, youtubeId, youtubeThumb, liveStateAt, liveStateText, viewsText, promoShareMessage, promoRef, promoSubjectHref, validatePromo,
  savePromoPost, promoFeed, submitPromoBoost, decidePromoBoost, setPromoHidden, getPromoPost, type PromoInput } from "./promo";
import { friendlyError } from "./classified-listings";
import { getNotificationLink } from "./notifications";
import { reportTargetHref, REPORT_TARGET_LABELS } from "./trust";

const rpcClient = (data: unknown = null) => ({ rpc: vi.fn().mockResolvedValue({ data, error: null }) }) as any;
const base: PromoInput = { subjectKind: "provider", subjectId: "u1", kind: "video", title: "Instalações elétricas", externalUrl: "https://youtu.be/dQw4w9WgXcQ" };
const live = { kind: "live" as const, live_starts_at: "2026-10-18T19:00:00Z", live_ends_at: "2026-10-18T20:00:00Z" };

describe("vídeos e lives", () => {
  it("ligações aceites", () => {
    expect(videoPlatform("https://www.youtube.com/watch?v=abc")).toBe("YouTube");
    expect(videoPlatform("https://m.facebook.com/x/videos/1")).toBe("Facebook");
    expect(videoPlatform("https://vm.tiktok.com/ZM123/")).toBe("TikTok");
    expect(videoPlatform("https://www.instagram.com/reel/x")).toBe("Instagram");
    expect(videoPlatform("http://youtube.com/watch?v=a")).toBeNull();
    expect(videoPlatform("https://youtube.com.evil.ao/x")).toBeNull();
    expect(videoPlatform("https://notyoutube.com/x")).toBeNull();
    expect(videoPlatform("olá")).toBeNull();
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://facebook.com/x")).toBeNull();
    expect(youtubeThumb("https://youtu.be/dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });
  it("ver dentro do Site e da APP", () => {
    expect(embedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1&rel=0");
    expect(embedUrl("https://www.youtube.com/live/dQw4w9WgXcQ?si=x")).toContain("/embed/dQw4w9WgXcQ");
    expect(embedUrl("https://www.youtube.com/channel/UCabcdefghijklmnop12345/live")).toBe("https://www.youtube-nocookie.com/embed/live_stream?channel=UCabcdefghijklmnop12345&autoplay=1&playsinline=1");
    expect(embedUrl("https://www.youtube.com/@oficinaze/live")).toBeNull();
    expect(embedUrl("https://www.facebook.com/oficinaze/videos/123456/")).toBe("https://www.facebook.com/plugins/video.php?href=" + encodeURIComponent("https://www.facebook.com/oficinaze/videos/123456/") + "&show_text=false&autoplay=true&allowfullscreen=true");
    expect(embedUrl("https://fb.watch/abc123/")).toContain("plugins/video.php");
    expect(embedUrl("https://www.facebook.com/watch/?v=123")).toContain("plugins/video.php");
    expect(embedUrl("https://www.facebook.com/oficinaze")).toBeNull();
    expect(embedUrl("https://www.tiktok.com/@ze/live")).toBeNull();
    expect(embedUrl("https://evil.com/videos/1")).toBeNull();
    expect(embedUrl(null)).toBeNull();
    expect(embedHint("")).toBeNull();
    expect(embedHint("https://youtu.be/dQw4w9WgXcQ")?.ok).toBe(true);
    expect(embedHint("https://www.youtube.com/@oficinaze/live")?.text).toContain("youtube.com/live/");
    expect(embedHint("https://www.facebook.com/oficinaze")?.text).toContain("/videos/");
    expect(embedHint("https://www.tiktok.com/@ze/live")?.text).toBe("O TikTok não deixa ver dentro de outros sites: as pessoas vão abrir o TikTok.");
  });
  it("estado da live e textos", () => {
    expect(liveStateAt(live, Date.parse("2026-10-18T18:00:00Z"))).toBe("upcoming");
    expect(liveStateAt(live, Date.parse("2026-10-18T19:30:00Z"))).toBe("live");
    expect(liveStateAt(live, Date.parse("2026-10-18T21:00:00Z"))).toBe("ended");
    expect(liveStateAt({ kind: "video", live_starts_at: null, live_ends_at: null })).toBeNull();
    expect(liveStateText(live, Date.parse("2026-10-18T18:00:00Z"))).toBe("⏰ dom, 18/10/2026 · 20:00");
    expect(liveStateText(live, Date.parse("2026-10-18T19:30:00Z"))).toBe("🔴 Em direto agora");
    expect(viewsText(1)).toBe("1 visualização"); expect(viewsText(1500)).toBe("1 500 visualizações");
    expect(promoRef(1001)).toBe("V-1001");
    expect(promoSubjectHref("store", "s1")).toBe("/vendedor/s1"); expect(promoSubjectHref("business", "b1")).toBe("/empresas/b1");
    expect(promoShareMessage("https://huambo.ao/", { id: "p1", title: "Promoção", subject_name: "Loja X", kind: "video", live_starts_at: null, live_ends_at: null }))
      .toBe("🎬 Promoção — Loja X\n👉 https://huambo.ao/videos/p1");
  });
  it("validação", () => {
    expect(validatePromo(base)).toBeNull();
    expect(validatePromo({ ...base, subjectKind: "" })).toContain("em nome de quem");
    expect(validatePromo({ ...base, title: "Oi" })).toContain("título");
    expect(validatePromo({ ...base, externalUrl: "https://evil.com/x" })).toContain("YouTube, Facebook");
    expect(validatePromo({ ...base, externalUrl: "" })).toContain("Envie o vídeo");
    expect(validatePromo({ ...base, externalUrl: "", videoUrl: "https://x.supabase.co/storage/v1/object/public/media-videos/u/a.mp4" })).toBeNull();
    const l: PromoInput = { ...base, kind: "live", externalUrl: "https://facebook.com/x/live", liveStartsAt: "2099-10-18T20:00", liveMinutes: 60 };
    expect(validatePromo(l)).toBeNull();
    expect(validatePromo({ ...l, externalUrl: "" })).toContain("ligação da live");
    expect(validatePromo({ ...l, liveStartsAt: "" })).toContain("dia e a hora");
    expect(validatePromo({ ...l, liveStartsAt: "2020-01-01T10:00" })).toContain("futuro");
    expect(validatePromo({ ...l, liveMinutes: 0 })).toContain("quanto tempo");
  });
  it("erros, avisos e denúncias", () => {
    expect(friendlyError({ message: "POST_NOT_FOUND" })).toBe("Vídeo não encontrado.");
    expect(friendlyError({ message: "TOO_MANY_POSTS" })).toContain("5 vídeos");
    expect(friendlyError({ message: "BOOST_PENDING" })).toContain("destaque");
    expect(friendlyError({ message: 'new row for relation "promo_posts" violates check constraint "promo_posts_external_url_check"' })).toContain("YouTube");
    const id = "11111111-1111-4111-8111-111111111111";
    expect(getNotificationLink({ data: { for: "follow", source: "promo:x", post_id: id }, type: "system", title: "x" } as any)?.href).toBe("/videos/" + id);
    expect(getNotificationLink({ data: { for: "promo", post_id: id }, type: "system", title: "x" } as any)?.href).toBe("/videos/" + id);
    expect(reportTargetHref("promo_post", id)).toBe("/videos/" + id);
    expect(REPORT_TARGET_LABELS.promo_post).toBe("Vídeo ou live");
  });
  it("chamadas ao servidor", async () => {
    const c = rpcClient({ id: "p1" });
    expect((await savePromoPost(c, { ...base, title: "" })).error?.message).toContain("título");
    await savePromoPost(c, { ...base, description: " Bom ", videoUrl: "ignorado-se-for-live" });
    expect(c.rpc).toHaveBeenLastCalledWith("save_promo_post", expect.objectContaining({ p_id: null, p_subject_kind: "provider", p_kind: "video", p_description: "Bom",
      p_external_url: "https://youtu.be/dQw4w9WgXcQ", p_live_starts_at: null, p_live_minutes: null }));
    await savePromoPost(c, { ...base, kind: "live", externalUrl: "https://facebook.com/x/live", liveStartsAt: "2020-01-01T20:00", liveMinutes: 60, videoUrl: "x" }, "p1");
    expect(c.rpc).toHaveBeenLastCalledWith("save_promo_post", expect.objectContaining({ p_id: "p1", p_kind: "live", p_video_url: null, p_live_starts_at: "2020-01-01T19:00:00.000Z", p_live_minutes: 60 }));
    const f = rpcClient([{ id: "p1", views: "7" }]);
    expect((await promoFeed(f, { kind: "live" })).data[0].views).toBe(7);
    expect(f.rpc).toHaveBeenCalledWith("promo_feed", { p_kind: "live", p_subject_kind: null, p_subject_id: null, p_limit: 40 });
    expect((await getPromoPost(rpcClient([]), "x")).data).toBeNull();
    expect((await submitPromoBoost(c, "p1", { method: "multicaixa_express" })).error?.message).toContain("referência");
    expect((await decidePromoBoost(c, "b1", false)).error?.message).toBe("Escreva o motivo.");
    expect((await setPromoHidden(c, "p1", true, " ")).error?.message).toContain("motivo");
  });
});
