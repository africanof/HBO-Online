import { profileUrl, qrPng, validProfileQrRequest } from "@huambo-online/core";
import { SITE_URL } from "../../../lib/site";

// Imagem PNG do código QR de um perfil (profissional, empresa, loja, estabelecimento, posto, praça), para baixar e imprimir.
export function GET(req: Request) {
  const u = new URL(req.url);
  const kind = u.searchParams.get("kind"), id = u.searchParams.get("id");
  if (!validProfileQrRequest(kind, id)) return new Response("Pedido inválido.", { status: 400 });
  const png = qrPng(profileUrl(SITE_URL, kind, id!), 12);
  return new Response(png as unknown as BodyInit, { headers: {
    "Content-Type": "image/png", "Cache-Control": "public, max-age=86400, immutable",
    "Content-Disposition": `${u.searchParams.has("download") ? "attachment" : "inline"}; filename="qr-${kind}-${id!.slice(0, 8)}.png"`
  } });
}
