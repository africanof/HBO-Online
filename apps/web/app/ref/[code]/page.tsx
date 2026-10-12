"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { findByRef, parseRef, refHref, friendlyError, REF_LABELS } from "@huambo-online/core";
import { supabase } from "../../../lib/supabase";

/** Abre um anúncio, produto ou encomenda pelo número (ex.: A-1001). */
export default function RefPage() {
  const { code } = useParams<{ code: string }>(); const router = useRouter();
  const ref = parseRef(decodeURIComponent(code ?? ""));
  const [msg, setMsg] = useState(ref ? "A procurar…" : "");
  useEffect(() => {
    if (!ref) return;
    void findByRef(supabase(), ref.code).then(r => {
      if (r.error) setMsg(friendlyError(r.error));
      else if (r.data) router.replace(refHref(r.data.kind, r.data.id));
      else setMsg(`Não encontrámos ${REF_LABELS[ref.kind].toLowerCase()} com o número ${ref.code}.` + (ref.kind === "order" ? " As encomendas só aparecem a quem comprou ou vendeu (inicie sessão)." : ""));
    });
  }, [code]);
  return <main className="stack">
    <a href="/">← Início</a>
    <h1>{ref ? ref.code : "Número inválido"}</h1>
    {ref ? <p role="status">{msg}</p> : <p>Os números são assim: <strong>A-1001</strong> (anúncio), <strong>P-1001</strong> (produto) ou <strong>E-1001</strong> (encomenda).</p>}
  </main>;
}
