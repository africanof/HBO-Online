import { assetLinks, parseSha256Fingerprints } from "@huambo-online/core";

// Prova ao Android que a APP pertence a este site: com a APP instalada, os QR abrem na APP.
// A impressão digital (SHA-256) do certificado da APP fica na variável ANDROID_SHA256_FINGERPRINTS (Render).
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(assetLinks(parseSha256Fingerprints(process.env.ANDROID_SHA256_FINGERPRINTS)), {
    headers: { "Cache-Control": "public, max-age=3600" }
  });
}
