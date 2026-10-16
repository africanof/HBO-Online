"use client";
import { FormEvent, useEffect, useState } from "react";
import { listTotpFactors, startTotpEnrollment, verifyTotp, disableTotp, mfaRequired, mfaErrorMessage, formatTotpSecret,
  MFA_STEPS, type MfaFactor, type MfaEnrollment } from "@huambo-online/core";
import { supabase, currentUserId } from "../../../lib/supabase";
import { MfaGate, MfaPrompt, TotpCodeInput } from "../../../components/Mfa";

function Security() {
  const [factor, setFactor] = useState<MfaFactor | null | undefined>(undefined);
  const [enroll, setEnroll] = useState<MfaEnrollment | null>(null);
  const [code, setCode] = useState(""); const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [askCode, setAskCode] = useState(false);

  async function load() {
    const r = await listTotpFactors(supabase());
    if (r.error) setError(mfaErrorMessage(r.error));
    setFactor(r.data.find(f => f.status === "verified") ?? null);
  }
  useEffect(() => { void load(); }, []);

  async function start() {
    setBusy(true); setError(""); setNotice(""); setCopied(false);
    const r = await startTotpEnrollment(supabase());
    setBusy(false);
    if (r.error || !r.data) { setError(mfaErrorMessage(r.error)); return; }
    setEnroll(r.data); setCode("");
  }
  async function confirm(e: FormEvent) {
    e.preventDefault(); if (!enroll || busy) return;
    setBusy(true); setError("");
    const r = await verifyTotp(supabase(), enroll.factorId, code);
    setBusy(false);
    if (r.error) { setError(mfaErrorMessage(r.error)); setCode(""); return; }
    setEnroll(null); setCode("");
    setNotice("✔ Pronto! A entrada em dois passos está ligada. Da próxima vez que entrar, vamos pedir o código da APP autenticadora.");
    await load();
  }
  async function cancelEnroll() {
    if (enroll) await disableTotp(supabase(), enroll.factorId); // apaga a tentativa por confirmar
    setEnroll(null); setCode(""); setError("");
  }
  async function copy() {
    if (!enroll) return;
    try { await navigator.clipboard.writeText(enroll.secret); setCopied(true); } catch { setError("Não foi possível copiar. Escreva a chave à mão."); }
  }
  async function turnOff() {
    if (!factor) return;
    if (!window.confirm("Desligar a entrada em dois passos? A sua conta fica menos protegida: basta a palavra-passe para entrar.")) return;
    setError(""); setNotice("");
    // Para desligar, a sessão tem de estar confirmada com o código (nível 2).
    if (await mfaRequired(supabase())) { setAskCode(true); return; }
    await doTurnOff();
  }
  async function doTurnOff() {
    if (!factor) return;
    setAskCode(false); setBusy(true);
    const r = await disableTotp(supabase(), factor.id);
    setBusy(false);
    if (r.error) { setError(mfaErrorMessage(r.error)); return; }
    setNotice("A entrada em dois passos foi desligada."); await load();
  }

  return <main className="stack" style={{ maxWidth: 640 }}>
    <a href="/conta">← A sua conta</a>
    <h1>🔐 Entrar em dois passos</h1>
    <p style={{ margin: 0 }}>Proteja a sua conta: além da palavra-passe, para entrar é preciso um código de 6 algarismos que muda a cada 30 segundos, mostrado por uma APP no seu telemóvel. Mesmo que alguém descubra a palavra-passe, não consegue entrar sem o seu telemóvel.</p>
    {notice && <p className="ok" role="status">{notice}</p>}
    {factor === undefined ? <p>A carregar…</p> : factor ? <section className="card">
      <p className="ok" style={{ margin: 0 }}>✔ Ligado</p>
      <p style={{ margin: 0 }}>A entrada em dois passos está ligada{factor.created_at ? ` desde ${new Date(factor.created_at).toLocaleDateString("pt-AO")}` : ""}. Ao entrar, vamos pedir o código da APP autenticadora.</p>
      {askCode ? <MfaPrompt title="Confirme com o código para desligar" onDone={() => void doTurnOff()} onCancel={() => setAskCode(false)} />
        : <div className="row"><button type="button" className="danger" disabled={busy} onClick={turnOff}>{busy ? "Aguarde…" : "Desligar"}</button></div>}
      {error && <p className="error" role="alert">{error}</p>}
    </section> : enroll ? <section className="card">
      <h2 style={{ margin: 0 }}>Ligar a APP autenticadora</h2>
      <ol style={{ margin: 0, paddingLeft: 22 }}>{MFA_STEPS.map(s => <li key={s}>{s}</li>)}</ol>
      <img className="totp-qr" src={enroll.qrCode} alt="Código QR para ler com a APP autenticadora" />
      <p style={{ margin: 0 }}>Não consegue ler o código QR? Na APP escolha «Introduzir chave» e escreva esta chave:</p>
      <div className="row">
        <code className="totp-secret" aria-label="Chave para escrever na APP">{formatTotpSecret(enroll.secret)}</code>
        <button type="button" className="secondary" onClick={copy}>{copied ? "✔ Copiada" : "📋 Copiar a chave"}</button>
      </div>
      <form className="stack" onSubmit={confirm}>
        <TotpCodeInput value={code} onChange={setCode} label="Código de 6 algarismos que a APP mostra" />
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row">
          <button type="submit" disabled={busy || code.length !== 6}>{busy ? "A confirmar…" : "Confirmar e ligar"}</button>
          <button type="button" className="secondary" onClick={cancelEnroll}>Cancelar</button>
        </div>
      </form>
    </section> : <section className="card">
      <p style={{ margin: 0 }}><strong>Está desligada.</strong> Como ligar:</p>
      <ol style={{ margin: 0, paddingLeft: 22 }}>{MFA_STEPS.map(s => <li key={s}>{s}</li>)}</ol>
      <p style={{ margin: 0 }}>⚠️ Se perder o telemóvel ou apagar a APP, deixa de conseguir entrar sozinho: terá de falar com a administração.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row"><button type="button" disabled={busy} onClick={start}>{busy ? "Aguarde…" : "Ligar"}</button></div>
    </section>}
  </main>;
}

export default function SegurancaPage() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  useEffect(() => { void currentUserId().then(setUid, () => setUid(null)); }, []);
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main><a href="/conta">← A sua conta</a><h1>🔐 Entrar em dois passos</h1><p><a href="/conta/login?voltar=/conta/seguranca">Inicie sessão</a> para proteger a sua conta.</p></main>;
  return <MfaGate intro="Esta conta tem a entrada em dois passos ligada. Para mudar estas definições, escreva primeiro o código da APP autenticadora."><Security /></MfaGate>;
}
