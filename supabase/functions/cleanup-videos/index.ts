// Apaga do Storage os vídeos que já não são precisos (anúncio fechado/vendido há 7 dias,
// produto escondido há 30 dias, artigo apagado ou vídeo trocado).
// Corre todos os dias pelo pg_cron. Só apaga o que a base de dados indica como vencido,
// por isso pode ser chamada várias vezes sem problema.
// A chave de serviço só existe aqui, no servidor (nunca no Site nem na APP).
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "media-videos";

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const due = await supabase.rpc("videos_due_for_cleanup");
  if (due.error) return Response.json({ ok: false, step: "listar", error: due.error.message }, { status: 500 });
  const paths = [...new Set(((due.data ?? []) as { path: string | null }[]).map(r => r.path).filter((p): p is string => !!p))];
  if (!paths.length) return Response.json({ ok: true, removed: 0 });
  for (let i = 0; i < paths.length; i += 100) {
    const removed = await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    if (removed.error) return Response.json({ ok: false, step: "apagar", error: removed.error.message }, { status: 500 });
  }
  const marked = await supabase.rpc("mark_videos_removed", { p_paths: paths });
  if (marked.error) return Response.json({ ok: false, step: "marcar", error: marked.error.message }, { status: 500 });
  return Response.json({ ok: true, removed: paths.length });
});
