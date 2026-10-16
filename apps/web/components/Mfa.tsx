"use client";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { verifyLoginTotp, mfaRequired, mfaErrorMessage, normalizeTotpCode, signOutCurrentUser } from "@huambo-online/core";
import { supabase } from "../lib/supabase";

/** Campo dos 6 algarismos da APP autenticadora. */
export function TotpCodeInput({ value, onChange, id = "totp-code", label = "Código da APP autenticadora" }: { value: string; onChange: (v: string) => void; id?: string; label?: string }) {
  return <label htmlFor={id}>{label}
    <input id={id} className="code-input" value={value} onChange={e => onChange(normalizeTotpCode(e.target.value).slice(0, 6))}
      inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" placeholder="000000" required />
  </label>;
}

/** Pede o código da APP autenticadora para subir a sessão para o nível 2 (aal2). */
export function MfaPrompt({ onDone, onCancel, title = "Código da APP autenticadora", intro }: { onDone: () => void; onCancel?: () => void; title?: string; intro?: ReactNode }) {
  const [code, setCode] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    const r = await verifyLoginTotp(supabase(), code);
    setBusy(false);
    if (r.error) { setError(mfaErrorMessage(r.error)); setCode(""); return; }
    onDone();
  }
  return <form className="stack card" onSubmit={submit} style={{ maxWidth: 480 }}>
    <h2 style={{ margin: 0 }}>🔐 {title}</h2>
    <p style={{ margin: 0 }}>{intro ?? "Abra a APP autenticadora (Google Authenticator, Microsoft Authenticator ou Authy) e escreva os 6 algarismos que aparecem para o Huambo Online."}</p>
    <TotpCodeInput value={code} onChange={setCode} />
    {error && <p className="error" role="alert">{error}</p>}
    <div className="row">
      <button type="submit" disabled={busy || code.length !== 6}>{busy ? "A confirmar…" : "Confirmar"}</button>
      {onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancelar</button>}
    </div>
  </form>;
}

/** Mostra o conteúdo só depois de confirmar o código, quando a conta tem APP autenticadora e a sessão ainda não foi confirmada. */
export function MfaGate({ children, intro }: { children: ReactNode; intro?: ReactNode }) {
  const [state, setState] = useState<"checking" | "need" | "ok">("checking");
  useEffect(() => { void mfaRequired(supabase()).then(need => setState(need ? "need" : "ok"), () => setState("ok")); }, []);
  if (state === "checking") return <main><p>A carregar…</p></main>;
  if (state === "need") return <main className="stack">
    <a href="/conta">← A sua conta</a>
    <h1>Confirmar que é você</h1>
    <MfaPrompt intro={intro} onDone={() => setState("ok")}
      onCancel={async () => { await signOutCurrentUser(supabase()); window.location.href = "/conta/login"; }} />
  </main>;
  return <>{children}</>;
}
