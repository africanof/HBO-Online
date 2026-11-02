"use client";
import { useEffect, useState } from "react";
import { createSupabaseClient } from "@huambo-online/supabase";
import { unsubscribeEmail } from "@huambo-online/core";
import { useT } from "../../../lib/i18n";

const u = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", k = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** Página da ligação «cancelar estes emails» (não precisa de sessão iniciada). */
export default function CancelEmails() {
  const { t } = useT();
  const [token, setToken] = useState(""); const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  useEffect(() => { setToken(new URLSearchParams(window.location.search).get("t") ?? ""); }, []);
  async function run() {
    setState("busy");
    const r = await unsubscribeEmail(createSupabaseClient(u, k), token);
    setState(r.ok ? "done" : "error");
  }
  return <main style={{ maxWidth: 560, margin: "0 auto", padding: 32 }}>
    <h1>{t("em.unsub.title")}</h1>
    {state === "done" ? <p role="status">{t("em.unsub.done")}</p> : <>
      <p>{t("em.unsub.text")}</p>
      <button type="button" disabled={!token || state === "busy"} onClick={() => void run()}>{t("em.unsub.button")}</button>
      {state === "error" && <p className="error" role="alert">{t("em.unsub.error")}</p>}
    </>}
    <p style={{ marginTop: 24 }}><a href="/notificacoes/preferencias">{t("ls.notif_prefs")} →</a></p>
  </main>;
}
