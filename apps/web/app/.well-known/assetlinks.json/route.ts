import { assetLinks, appLinkFingerprints } from "@huambo-online/core";

// Prova ao Android que a APP pertence a este site: com a APP instalada, os QR abrem na APP.
// A impressão digital (SHA-256) do certificado da APP está no core; ANDROID_SHA256_FINGERPRINTS (variável do alojamento) junta outras, se um dia mudar.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(assetLinks(appLinkFingerprints(process.env.ANDROID_SHA256_FINGERPRINTS)), {
    headers: { "Cache-Control": "public, max-age=3600" }
  });
}
