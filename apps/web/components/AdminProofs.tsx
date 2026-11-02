"use client";
import { useEffect, useState } from "react";
import { listProofChecks, decideProofPayment, paymentProofUrl, formatPrice, friendlyErrorIn, proofMark, PROOF_VERDICT_ICON, type ProofCheck } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT, formatDateIn } from "../lib/i18n";

const COLOR: Record<string, string> = { match: "var(--green, #2E7D32)", check: "var(--logo-yellow, #E5A800)", suspicious: "var(--danger, #C62828)", unreadable: "#888", pending: "#888" };

/**
 * Comprovativos por decidir: a IA lê o talão e a base de dados confere o valor, a conta de destino,
 * a data e se o n.º da operação já foi usado. A equipa confirma (sempre depois de ver o extrato).
 */
export function AdminProofs() {
  const { lang, t } = useT();
  const [list, setList] = useState<ProofCheck[]>([]); const [err, setErr] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);
  async function load() { const r = await listProofChecks(supabase()); if (r.error) setErr(friendlyErrorIn(r.error, lang)); else setList(r.data); }
  useEffect(() => { void load(); }, []);
  async function view(path: string) { const r = await paymentProofUrl(supabase(), path); if (r.data) window.open(r.data, "_blank", "noopener"); }
  async function decide(p: ProofCheck, confirm: boolean) {
    let note: string | null = null;
    if (confirm) { if (!confirm_(t("pf.confirm_q"))) return; }
    else { note = prompt(t("pf.reason_q")); if (!note?.trim()) return; }
    setBusy(true); setErr(""); setOk("");
    const r = await decideProofPayment(supabase(), p.kind, p.payment_id, confirm, note); setBusy(false);
    if (r.error) { setErr(friendlyErrorIn(r.error, lang)); return; }
    setOk(confirm ? t("pf.ok_confirmed") : t("pf.ok_rejected")); await load();
  }
  return <section className="stack">
    <p style={{ margin: 0 }}>{t("pf.intro")}</p>
    {err && <p className="error" role="alert">{err}</p>}
    {ok && <p className="ok" role="status">{ok}</p>}
    {!list.length && <p>{t("pf.none")}</p>}
    {list.map(p => <article key={p.kind + p.payment_id} className="card" style={{ borderLeft: `4px solid ${COLOR[p.verdict]}` }}>
      <strong>{PROOF_VERDICT_ICON[p.verdict]} {t("pf.verdict." + p.verdict)} · {p.label}</strong>
      <span>{t("pf.expected")}: <strong>{formatPrice(p.amount)}</strong> · {t("pf.payer")}: <a href={"/vendedor/" + p.payer_id} target="_blank">{p.payer_name ?? "—"}</a> · {formatDateIn(p.created_at, lang)}</span>
      {p.reference && <small>{t("pf.client_ref")}: {p.reference}</small>}
      {p.summary && <p style={{ margin: 0 }}>🤖 {p.summary}</p>}
      {p.verdict !== "pending" && p.verdict !== "unreadable" && <small>
        {t("pf.read")}: {t("pf.amount")} {p.read_amount != null ? formatPrice(p.read_amount) : "—"} {proofMark(p.amount_ok)} · {t("pf.destination")} {p.read_destination ?? "—"} {proofMark(p.destination_ok)} · {t("pf.date")} {p.read_date ?? "—"} {proofMark(p.date_ok)} · {t("pf.operation")} {p.read_operation ?? "—"}{p.duplicate_id ? " ✖" : ""}
        {p.read_beneficiary ? ` · ${t("pf.beneficiary")} ${p.read_beneficiary}` : ""}{p.read_bank ? ` · ${t("pf.bank")} ${p.read_bank}` : ""}
      </small>}
      <div className="row">
        <button className="secondary" onClick={() => void view(p.proof_path)}>🧾 {t("pf.view")}</button>
        <button disabled={busy} onClick={() => void decide(p, true)}>{t("pf.confirm")}</button>
        <button className="danger" disabled={busy} onClick={() => void decide(p, false)}>{t("pf.reject")}</button>
      </div>
    </article>)}
  </section>;
}
const confirm_ = (q: string) => window.confirm(q);
