import type { Lang } from "./i18n";
import { friendlyError } from "./classified-listings";
import { authErrorMessage } from "./account-security";
import { mfaErrorMessage } from "./mfa";

/**
 * Tradução dos textos que o core devolve em português (etiquetas, estados, validações e mensagens de erro).
 * A chave é o próprio texto em português; os textos com partes variáveis usam CORE_PATTERNS ($1, $2… = partes apanhadas).
 */
export type CoreText = Record<string, { en: string; zh: string }>;
export const CORE_TEXT: CoreText = {};
export const CORE_PATTERNS: { re: RegExp; en: string; zh: string }[] = [];

/** Traduz um texto vindo do core; se não o conhecer, devolve-o como está. */
export function tc(text: string, lang: Lang): string;
export function tc(text: string | null | undefined, lang: Lang): string | null | undefined;
export function tc(text: string | null | undefined, lang: Lang): string | null | undefined {
  if (text == null || lang === "pt" || text === "") return text;
  const hit = CORE_TEXT[text];
  if (hit) return hit[lang];
  for (const p of CORE_PATTERNS) {
    const m = p.re.exec(text);
    if (m) return p[lang].replace(/\$(\d)/g, (_, i) => tc(m[Number(i)] ?? "", lang) ?? "");
  }
  return text;
}
export function friendlyErrorIn(error: unknown, lang: Lang, fallback?: string): string { return tc(friendlyError(error, fallback), lang); }
export function authErrorIn(error: unknown, lang: Lang): string { return tc(authErrorMessage(error), lang); }
export function mfaErrorIn(error: unknown, lang: Lang): string { return tc(mfaErrorMessage(error), lang); }
