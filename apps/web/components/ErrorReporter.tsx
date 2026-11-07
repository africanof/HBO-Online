"use client";
import { useEffect } from "react";
import { logAppError } from "@huambo-online/core";
import { supabase, supabaseConfigured } from "../lib/supabase";

/** Erros do Site: envia à equipa (mensagem, página e navegador), no máximo um a cada 5 segundos. */
let last = 0;
export function reportSiteError(e: unknown, fatal = false) {
  if (!supabaseConfigured || typeof window === "undefined") return;
  const now = Date.now(); if (now - last < 5000) return; last = now;
  const err = e instanceof Error ? e : new Error(String((e as any)?.message ?? e));
  const screen = window.location.pathname.replace(/[0-9a-f-]{36}/gi, "[id]");
  void Promise.resolve(logAppError(supabase(), { message: err.message, stack: err.stack ?? null, screen, version: "site", platform: "web", fatal })).catch(() => {});
}

/** Apanha os erros do próprio Site (ignora os de extensões do navegador e de outros sites). */
export function ErrorReporter() {
  useEffect(() => {
    const own = (src?: string) => !src || src.startsWith(window.location.origin);
    const onError = (ev: ErrorEvent) => { if (own(ev.filename)) reportSiteError(ev.error ?? ev.message); };
    const onReject = (ev: PromiseRejectionEvent) => { const r = ev.reason; if (r instanceof Error && /chunk|loading css/i.test(r.message)) reportSiteError(r); };
    window.addEventListener("error", onError); window.addEventListener("unhandledrejection", onReject);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onReject); };
  }, []);
  return null;
}
