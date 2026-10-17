import type { Lang } from "./i18n";
import { friendlyError } from "./classified-listings";
import { authErrorMessage } from "./account-security";
import { mfaErrorMessage } from "./mfa";
import { CORE_ERROR_ROWS, type CoreRow } from "./i18n-core-errors";
import { CORE_LABEL_ROWS } from "./i18n-core-labels";
import { CORE_MESSAGE_ROWS } from "./i18n-core-messages";
import { CORE_LEGAL_ROWS } from "./i18n-core-legal";
import { CORE_PATTERNS_LIST, CORE_PATTERN_WORD_ROWS } from "./i18n-core-patterns";
import { CORE_NOTIFICATION_ROWS, CORE_NOTIFICATION_PATTERNS } from "./i18n-core-notifications";
import { CORE_DELIVERY_ROWS, CORE_DELIVERY_PATTERNS } from "./i18n-core-delivery";

/**
 * Tradução dos textos que o core devolve em português (etiquetas, estados, validações e mensagens de erro).
 * A chave é o próprio texto em português; os textos com partes variáveis usam CORE_PATTERNS ($1, $2… = partes apanhadas).
 */
export type CoreText = Record<string, { en: string; zh: string }>;
function rowsToText(...groups: CoreRow[][]): CoreText {
  const out: CoreText = {};
  for (const rows of groups) for (const [pt, en, zh] of rows) out[pt] = { en, zh };
  return out;
}
export const CORE_TEXT: CoreText = rowsToText(CORE_LABEL_ROWS, CORE_MESSAGE_ROWS, CORE_ERROR_ROWS, CORE_LEGAL_ROWS, CORE_NOTIFICATION_ROWS, CORE_PATTERN_WORD_ROWS, CORE_DELIVERY_ROWS);
export const CORE_PATTERNS: { re: RegExp; en: string; zh: string }[] = [...CORE_DELIVERY_PATTERNS, ...CORE_NOTIFICATION_PATTERNS, ...CORE_PATTERNS_LIST];

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
