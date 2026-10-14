import { createPublicApi } from "@huambo-online/core";
import { siteUrl } from "./supabase";

/**
 * Listas públicas pela cache do Site (menos consultas à base de dados).
 * Se o Site demorar mais de 3 s (pode estar a acordar), a APP vai direto ao Supabase e só volta a tentar daqui a 5 minutos.
 */
export const getPublic = createPublicApi(siteUrl, { timeoutMs: 3000, pauseMs: 5 * 60_000 });
