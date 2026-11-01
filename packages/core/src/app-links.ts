/**
 * Android App Links: quando o telemóvel tem a APP, os QR (reservas, combustível, bilhetes e perfis) abrem na APP;
 * sem a APP abrem no site. O site publica /.well-known/assetlinks.json com a impressão digital (SHA-256)
 * do certificado que assina a APP (expo.dev → projeto → Credentials → Android).
 */
export const ANDROID_PACKAGE = "ao.huamboonline.app";
/** Caminhos do site que a APP abre sozinha (iguais em app.json). */
/** Certificado que assina a APP na Expo (lido pela ação «APP Android — impressão digital»). Público. */
export const ANDROID_SHA256_FINGERPRINT = "56789542025662d3fececbfd153671c47b5025af06b56b2d6ec5657284e03939";
/** Inclui as páginas de perfil (QR de cada profissional, empresa, loja, estabelecimento, posto e praça). */
export const APP_LINK_PATHS = ["/reservas/", "/combustivel/", "/eventos/bilhete/", "/profissionais/", "/empresas/", "/vendedor/", "/pracas/"] as const;

/** «AB:CD:…» com 32 pares; aceita minúsculas, espaços e várias separadas por vírgulas. Devolve só as válidas. */
export function parseSha256Fingerprints(text: string | null | undefined): string[] {
  return (text ?? "").split(/[,;\n]+/).map(s => s.replace(/[^0-9a-f]/gi, "").toUpperCase())
    .filter(s => s.length === 64).map(s => s.match(/.{2}/g)!.join(":"))
    .filter((s, i, a) => a.indexOf(s) === i);
}
/** Impressões digitais a publicar: as da variável (se houver) mais a da APP. */
export function appLinkFingerprints(envValue?: string | null): string[] {
  return parseSha256Fingerprints([envValue ?? "", ANDROID_SHA256_FINGERPRINT].join(","));
}
export function assetLinks(fingerprints: string[], packageName = ANDROID_PACKAGE) {
  if (!fingerprints.length) return [];
  return [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: packageName, sha256_cert_fingerprints: fingerprints } }];
}
