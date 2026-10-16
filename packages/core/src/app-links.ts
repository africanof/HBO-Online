/**
 * Android App Links: quando o telemóvel tem a APP, os QR (reservas, combustível, bilhetes) abrem na APP;
 * sem a APP abrem no site. O site publica /.well-known/assetlinks.json com a impressão digital (SHA-256)
 * do certificado que assina a APP (expo.dev → projeto → Credentials → Android).
 */
export const ANDROID_PACKAGE = "ao.huamboonline.app";
/** Caminhos do site que a APP abre sozinha (iguais em app.json). */
export const APP_LINK_PATHS = ["/reservas/v/", "/combustivel/v/", "/eventos/bilhete/"] as const;

/** «AB:CD:…» com 32 pares; aceita minúsculas, espaços e várias separadas por vírgulas. Devolve só as válidas. */
export function parseSha256Fingerprints(text: string | null | undefined): string[] {
  return (text ?? "").split(/[,;\n]+/).map(s => s.replace(/[^0-9a-f]/gi, "").toUpperCase())
    .filter(s => s.length === 64).map(s => s.match(/.{2}/g)!.join(":"))
    .filter((s, i, a) => a.indexOf(s) === i);
}
export function assetLinks(fingerprints: string[], packageName = ANDROID_PACKAGE) {
  if (!fingerprints.length) return [];
  return [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: packageName, sha256_cert_fingerprints: fingerprints } }];
}
