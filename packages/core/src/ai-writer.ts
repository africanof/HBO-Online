import type { SupabaseClient } from "@supabase/supabase-js";

/** «✨ Melhorar com IA» (OpenAI gpt-4o-mini no servidor): só com sessão iniciada, 15 por dia. */
export const AI_WRITER_DAILY_LIMIT = 15;

export type AiWriterInput = {
  title: string; description: string;
  category?: string; listingType?: string; purpose?: string;
  details?: Record<string, string | number | boolean | null | undefined>;
};
export type AiWriterResult = { optimized_title: string; optimized_description: string; remaining: number };
export type AiWriterErrorCode = "AUTH_REQUIRED" | "AI_WRITER_LIMIT" | "AI_NOT_CONFIGURED" | "AI_NEEDS_TEXT" | "AI_FAILED" | "NETWORK";

const MESSAGES: Record<AiWriterErrorCode, string> = {
  AUTH_REQUIRED: "Inicie sessão para melhorar o anúncio com IA.",
  AI_WRITER_LIMIT: `Já usou as ${AI_WRITER_DAILY_LIMIT} melhorias com IA de hoje. Volte amanhã.`,
  AI_NOT_CONFIGURED: "A melhoria com IA ainda não está ativa. Tente mais tarde.",
  AI_NEEDS_TEXT: "Escreva primeiro um título ou uma pequena descrição.",
  AI_FAILED: "Não conseguimos melhorar o texto agora. Tente de novo.",
  NETWORK: "Sem ligação à internet. Verifique os dados móveis ou o Wi-Fi."
};
export function aiWriterMessage(code: string): string {
  return MESSAGES[code as AiWriterErrorCode] ?? MESSAGES.AI_FAILED;
}

/** Há texto suficiente para pedir uma melhoria? */
export function canImproveText(title: string, description: string): boolean {
  return title.trim().length >= 3 || description.trim().length >= 10;
}

/** Envia o rascunho para a função «generate-ad» e devolve o título e a descrição melhorados. */
export async function improveListingText(client: SupabaseClient, input: AiWriterInput): Promise<{ data: AiWriterResult | null; error: AiWriterErrorCode | null }> {
  if (!canImproveText(input.title ?? "", input.description ?? "")) return { data: null, error: "AI_NEEDS_TEXT" };
  const { data: s } = await client.auth.getSession();
  if (!s.session) return { data: null, error: "AUTH_REQUIRED" };
  const details: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.details ?? {})) if (v !== null && v !== undefined && v !== "") details[k] = String(v);
  try {
    const r = await client.functions.invoke("generate-ad", { body: {
      title: input.title, description: input.description, category: input.category ?? "",
      listingType: input.listingType ?? "", purpose: input.purpose ?? "", details
    } });
    if (r.error) {
      let code: string = "AI_FAILED";
      const ctx = (r.error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") { try { code = (await ctx.json())?.error ?? code; } catch { /* resposta sem JSON */ } }
      else if (/fetch|network/i.test(String((r.error as Error).message))) code = "NETWORK";
      return { data: null, error: (code in MESSAGES ? code : "AI_FAILED") as AiWriterErrorCode };
    }
    const d = r.data as AiWriterResult;
    if (!d?.optimized_title && !d?.optimized_description) return { data: null, error: "AI_FAILED" };
    return { data: d, error: null };
  } catch { return { data: null, error: "NETWORK" }; }
}
