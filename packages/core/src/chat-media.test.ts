import { describe, expect, it, vi } from "vitest";
import { chatAttachmentKind, chatFileExt, baseMime, formatSeconds, validateChatFile, messagePreview, uploadChatFile, sendAttachmentMessage, chatMediaUrls } from "./chat-media";
import { listMessages } from "./messaging";

describe("chat: fotos, vídeos e voz", () => {
  it("tipos de ficheiro", () => {
    expect(baseMime("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(chatAttachmentKind("audio/webm;codecs=opus")).toBe("audio");
    expect(chatAttachmentKind("image/jpeg")).toBe("image");
    expect(chatAttachmentKind("video/quicktime")).toBe("video");
    expect(chatAttachmentKind("application/pdf")).toBeNull();
    expect(chatFileExt("audio/mp4")).toBe("m4a"); expect(chatFileExt("video/quicktime")).toBe("mov");
    expect(formatSeconds(7)).toBe("0:07"); expect(formatSeconds(90)).toBe("1:30"); expect(formatSeconds(null)).toBe("0:00");
  });
  it("limites", () => {
    expect(validateChatFile({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(validateChatFile({ type: "image/jpeg", size: 6 * 1024 * 1024 })).toContain("5 MB");
    expect(validateChatFile({ type: "video/mp4", size: 1000, seconds: 75 })).toContain("75 segundos");
    expect(validateChatFile({ type: "audio/webm", size: 1000, seconds: 200 })).toContain("3:00");
    expect(validateChatFile({ type: "audio/webm", size: 1000, seconds: 0.4 })).toContain("curta");
    expect(validateChatFile({ type: "text/plain", size: 10 })).toContain("não pode ser enviado");
  });
  it("pré-visualização", () => {
    expect(messagePreview({ body: "Olá", attachment_kind: null, attachment_seconds: null })).toBe("Olá");
    expect(messagePreview({ body: "", attachment_kind: "audio", attachment_seconds: 12 })).toBe("🎤 Mensagem de voz (0:12)");
    expect(messagePreview({ body: "Veja a cor", attachment_kind: "image", attachment_seconds: null })).toBe("📷 Fotografia · Veja a cor");
    expect(messagePreview(null)).toBe("");
  });
  it("envio e leitura", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const createSignedUrls = vi.fn().mockResolvedValue({ data: [{ path: "c/u/a.webm", signedUrl: "https://x/s1" }], error: null });
    const inserted: any[] = []; let selected = "";
    const client = {
      storage: { from: () => ({ upload, createSignedUrls }) },
      from: () => ({ insert: (row: any) => { inserted.push(row); return { select: () => ({ single: async () => ({ data: row, error: null }) }) }; },
        select: (cols: string) => { selected = cols; return { eq: () => ({ order: async () => ({ data: [], error: null }) }) }; } })
    } as any;
    expect((await uploadChatFile(client, "c", "u", new ArrayBuffer(10), "text/plain")).error?.message).toContain("não pode");
    const r = await uploadChatFile(client, "c", "u", new ArrayBuffer(10), "audio/webm;codecs=opus", 5);
    expect(r.data).toMatch(/^c\/u\/.+\.webm$/);
    expect(upload).toHaveBeenCalledWith(r.data, expect.any(ArrayBuffer), { upsert: false, contentType: "audio/webm" });
    await sendAttachmentMessage(client, "c", "u", { kind: "audio", path: r.data!, seconds: 5.4 }, "  ");
    expect(inserted[0]).toEqual({ conversation_id: "c", sender_id: "u", body: "", attachment_kind: "audio", attachment_path: r.data, attachment_seconds: 5 });
    expect(await chatMediaUrls(client, ["c/u/a.webm", "c/u/a.webm", ""])).toEqual({ "c/u/a.webm": "https://x/s1" });
    expect(createSignedUrls).toHaveBeenCalledWith(["c/u/a.webm"], 3600);
    expect(await chatMediaUrls(client, [])).toEqual({});
    await listMessages(client, "c");
    expect(selected).toContain("attachment_kind,attachment_path,attachment_seconds");
  });
});
