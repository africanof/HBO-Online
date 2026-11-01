import { describe, expect, it } from "vitest";
import { validateVideo, videoTypeFromName, uploadVideo, removeUnsavedVideo, VIDEO_MAX_BYTES } from "./videos";
import { createClassifiedListing, updateClassifiedListing } from "./classified-listings";
import { saveProduct } from "./shop";

function fakeStorage() {
  const calls: any[] = [];
  const bucket = (b: string) => ({
    upload: (path: string, _f: any, o: any) => { calls.push({ op: "upload", b, path, o }); return Promise.resolve({ data: {}, error: null }); },
    getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/${b}/${path}` } }),
    remove: (paths: string[]) => { calls.push({ op: "remove", b, paths }); return Promise.resolve({ data: [], error: null }); }
  });
  const rows: any[] = [];
  const q: any = { select: () => q, eq: () => q, single: () => Promise.resolve({ data: {}, error: null }) };
  const client: any = { storage: { from: bucket }, from: () => ({ insert: (r: any) => { rows.push(r); return q; }, update: (r: any) => { rows.push(r); return q; } }), rpc: () => Promise.resolve({ data: null, error: null }) };
  return { client, calls, rows };
}

describe("vídeos", () => {
  it("valida tamanho, duração e formato", () => {
    expect(validateVideo({ size: VIDEO_MAX_BYTES + 1, type: "video/mp4" })).toMatch(/30 MB/);
    expect(validateVideo({ durationSeconds: 75, type: "video/mp4" })).toMatch(/75 segundos/);
    expect(validateVideo({ type: "video/avi" })).toMatch(/MP4 ou MOV/);
    expect(validateVideo({ size: 5_000_000, durationSeconds: 59.8, type: "video/quicktime" })).toBeNull();
    expect(videoTypeFromName("clip.MOV")).toBe("video/quicktime");
    expect(videoTypeFromName("clip.mp4")).toBe("video/mp4");
  });
  it("envia para o espaço dos vídeos, na pasta da pessoa", async () => {
    const { client, calls } = fakeStorage();
    const big = await uploadVideo(client, "u1", new ArrayBuffer(VIDEO_MAX_BYTES + 1), "a.mp4");
    expect(big.error).toBeTruthy(); expect(calls).toHaveLength(0);
    const r = await uploadVideo(client, "u1", new ArrayBuffer(10), "a.mov");
    expect(calls[0]).toMatchObject({ op: "upload", b: "media-videos", o: { contentType: "video/quicktime" } });
    expect(calls[0].path).toMatch(/^u1\/.+\.mov$/);
    expect(r.data).toMatch(/\/media-videos\/u1\//);
    await removeUnsavedVideo(client, r.data!);
    expect(calls[1]).toMatchObject({ op: "remove", b: "media-videos" });
  });
  it("guarda o vídeo no anúncio e no produto", async () => {
    const { client, rows } = fakeStorage();
    await createClassifiedListing(client, { ownerId: "u", listingType: "product", purpose: "sale", title: "Teste", videoUrl: "https://v" });
    await updateClassifiedListing(client, "l", { listingType: "product", purpose: "sale", title: "Teste" });
    await saveProduct(client, "u", { name: "Arroz", price: 10, stock: 1, categoryId: "c", municipalityId: "m", videoUrl: "https://v" });
    expect(rows[0].video_url).toBe("https://v");
    expect(rows[1].video_url).toBeNull();
    expect(rows[2].video_url).toBe("https://v");
  });
});
