import { createPublicApi } from "@huambo-online/core";
import { SITE_URL } from "./site";

/** Listas públicas pela cache do próprio Site (se falhar, quem chama vai direto ao Supabase). */
export const getPublic = createPublicApi(typeof window !== "undefined" ? window.location.origin : SITE_URL, { timeoutMs: 4000, pauseMs: 60_000 });
