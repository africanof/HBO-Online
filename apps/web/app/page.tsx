import { createSupabaseClient } from "@huambo-online/supabase";
import { searchClassifiedListings } from "@huambo-online/core";
import { HomeClient } from "./HomeClient";

// A página inicial é preparada no servidor e renovada a cada 2 minutos: os anúncios mais recentes aparecem
// logo (mesmo com internet lenta) e o Google consegue lê-los. O resto da página carrega no navegador.
export const revalidate = 120;

async function latestListings(): Promise<any[] | null> {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim(); const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
  if (!url || !key) return null;
  try {
    const r = await Promise.race([
      searchClassifiedListings(createSupabaseClient(url, key), { limit: 12 }),
      new Promise<null>(res => setTimeout(() => res(null), 3000))
    ]);
    return r && !r.error && Array.isArray(r.data) ? r.data : null;
  } catch { return null; }
}

export default async function Home() {
  return <HomeClient initialListings={await latestListings()} />;
}
