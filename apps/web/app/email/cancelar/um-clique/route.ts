/**
 * «Cancelar com um toque» (cabeçalho List-Unsubscribe dos emails): o programa de email faz POST aqui.
 * Um GET (abrir no navegador) vai para a página normal, que pede confirmação.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const isUuid = (v: string | null): v is string => !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export async function POST(req: Request) {
  const t = new URL(req.url).searchParams.get("t");
  if (!isUuid(t) || !url || !key) return new Response("invalid", { status: 400 });
  const r = await fetch(`${url}/rest/v1/rpc/unsubscribe_email`, {
    method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: t })
  });
  return new Response(r.ok ? "ok" : "error", { status: r.ok ? 200 : 502 });
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  return Response.redirect(new URL(`/email/cancelar?t=${encodeURIComponent(u.searchParams.get("t") ?? "")}`, u.origin), 303);
}
