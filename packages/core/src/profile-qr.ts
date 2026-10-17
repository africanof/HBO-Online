import { qrMatrix } from "./events";

/**
 * 📱 Código QR de cada perfil (profissional, empresa, loja/vendedor, estabelecimento, posto, praça) — igual no Site e na APP.
 * O QR leva à página pública (perfil, catálogo e localização). Com a APP instalada abre na APP; sem ela, no site.
 * Pode baixar-se em PNG (imagem) ou SVG (cartaz com o nome), partilhar-se e copiar-se a ligação.
 */
export type ProfileQrKind = "profissionais" | "empresas" | "vendedor" | "reservas" | "combustivel" | "pracas";
export const PROFILE_QR_KINDS: ProfileQrKind[] = ["profissionais", "empresas", "vendedor", "reservas", "combustivel", "pracas"];
export const PROFILE_QR_LABELS: Record<ProfileQrKind, string> = {
  profissionais: "Profissional", empresas: "Empresa", vendedor: "Loja", reservas: "Estabelecimento", combustivel: "Posto de combustível", pracas: "Praça"
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isProfileQrKind(v: unknown): v is ProfileQrKind { return typeof v === "string" && (PROFILE_QR_KINDS as string[]).includes(v); }
/** Endereço que vai dentro do QR. */
export function profileUrl(siteUrl: string, kind: ProfileQrKind, id: string): string { return `${siteUrl.replace(/\/+$/, "")}/${kind}/${id}`; }
/** Ligação para baixar a imagem PNG (gerada pelo site). */
export function profileQrPngUrl(siteUrl: string, kind: ProfileQrKind, id: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/api/qr?kind=${kind}&id=${encodeURIComponent(id)}`;
}
export function validProfileQrRequest(kind: unknown, id: unknown): kind is ProfileQrKind { return isProfileQrKind(kind) && typeof id === "string" && UUID_RE.test(id); }
/** Nome de ficheiro seguro: «qr-padaria-ekuikui.png». */
export function profileQrFilename(name: string | null | undefined, ext: "png" | "svg"): string {
  const slug = (name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  return `qr-${slug || "huambo-online"}.${ext}`;
}
/** Mensagem para partilhar (WhatsApp, etc.). */
export function profileShareText(name: string, url: string): string { return `${name} no Huambo Online — veja o perfil, os produtos e onde fica:\n👉 ${url}`; }

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Cartaz SVG: QR grande, nome por baixo e «Leia com a câmara». */
export function profileQrSvg(url: string, title: string, subtitle = "Leia com a câmara do telemóvel"): string {
  const m = qrMatrix(url); const n = m.length; const cell = 10, quiet = 4 * cell, size = n * cell + quiet * 2, footer = 90;
  let d = ""; m.forEach((row, r) => row.forEach((on, c) => { if (on) d += `M${quiet + c * cell} ${quiet + r * cell}h${cell}v${cell}h-${cell}z`; }));
  const short = title.length > 50 ? title.slice(0, 49) + "…" : title; const t = esc(short);
  // Letra mais pequena para nomes compridos (cabe sempre na largura do cartaz).
  const font = Math.max(10, Math.min(26, Math.floor((size - 40) / (Math.max(1, short.length) * 0.62))));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + footer}" viewBox="0 0 ${size} ${size + footer}">` +
    `<rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/>` +
    `<text x="${size / 2}" y="${size + 30}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${font}" font-weight="700" fill="#000">${t}</text>` +
    `<text x="${size / 2}" y="${size + 64}" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#333">${esc(subtitle)} · Huambo Online</text></svg>`;
}

// --- PNG sem bibliotecas (preto e branco, 1 bit por ponto, compressão «guardada») ---------------------
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes: Uint8Array): number { let c = 0xffffffff; for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function adler32(bytes: Uint8Array): number { let a = 1, b = 0; for (const x of bytes) { a = (a + x) % 65521; b = (b + a) % 65521; } return ((b << 16) | a) >>> 0; }
const u32 = (v: number) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
function chunk(type: string, data: Uint8Array): number[] {
  const td = new Uint8Array(4 + data.length); for (let i = 0; i < 4; i++) td[i] = type.charCodeAt(i); td.set(data, 4);
  return [...u32(data.length), ...td, ...u32(crc32(td))];
}
/** Imagem PNG do QR (scale = pontos por quadradinho, com margem branca de 4 quadradinhos). */
export function qrPng(text: string, scale = 10): Uint8Array {
  const m = qrMatrix(text); const n = m.length + 8; const w = n * scale; const rowBytes = Math.ceil(w / 8);
  const raw = new Uint8Array((rowBytes + 1) * w);
  for (let y = 0; y < w; y++) {
    const r = Math.floor(y / scale) - 4; const off = y * (rowBytes + 1); raw[off] = 0; // filtro 0
    for (let x = 0; x < w; x++) {
      const c = Math.floor(x / scale) - 4;
      const dark = r >= 0 && c >= 0 && r < m.length && c < m.length && m[r][c];
      if (!dark) raw[off + 1 + (x >> 3)] |= 0x80 >> (x & 7); // 1 = branco
    }
  }
  const blocks: number[] = [0x78, 0x01];
  for (let i = 0; i < raw.length; i += 65535) {
    const len = Math.min(65535, raw.length - i); const last = i + len >= raw.length ? 1 : 0;
    blocks.push(last, len & 255, len >> 8, ~len & 255, (~len >> 8) & 255); for (let j = 0; j < len; j++) blocks.push(raw[i + j]);
  }
  blocks.push(...u32(adler32(raw)));
  const ihdr = new Uint8Array([...u32(w), ...u32(w), 1, 0, 0, 0, 0]); // 1 bit, tons de cinzento
  return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...chunk("IHDR", ihdr), ...chunk("IDAT", new Uint8Array(blocks)), ...chunk("IEND", new Uint8Array(0))]);
}
