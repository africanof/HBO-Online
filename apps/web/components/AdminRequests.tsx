"use client";
import { useEffect, useState } from "react";
import { listTeamRequests, forwardTeamRequest, declineTeamRequest, teamRequestState, formatPrice, friendlyErrorIn, mapsUrl, type TeamRequest } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT, formatDateIn } from "../lib/i18n";

/**
 * Pedidos mediados: encomendas, reservas, bilhetes, pedidos de serviço, propostas e alugueres
 * chegam primeiro à equipa, que os reencaminha a quem os trata ou os recusa com um motivo.
 */
export function AdminRequests() {
  const { lang, t } = useT();
  const [pendingOnly, setPendingOnly] = useState(true);
  const [list, setList] = useState<TeamRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({}); const [share, setShare] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);

  async function load() {
    const r = await listTeamRequests(supabase(), pendingOnly);
    if (r.error) setErr(friendlyErrorIn(r.error, lang)); else setList(r.data);
  }
  useEffect(() => { void load(); }, [pendingOnly]);
  async function run(fn: () => PromiseLike<{ error: any }>, message: string) {
    setBusy(true); setErr(""); setOk("");
    const r = await fn(); setBusy(false);
    if (r.error) { setErr(friendlyErrorIn(r.error, lang)); return; }
    setOk(message); await load();
  }

  return <section className="stack">
    <p style={{ margin: 0 }}>{t("ad.req.intro")}</p>
    <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={pendingOnly} onChange={e => setPendingOnly(e.target.checked)} style={{ width: 22, height: 22 }} /> {t("ad.req.pending_only")}</label>
    {err && <p className="error" role="alert">{err}</p>}
    {ok && <p className="ok" role="status">{ok}</p>}
    {!list.length && <p>{t("ad.req.none")}</p>}
    {list.map(r => {
      const key = r.kind + ":" + r.id; const state = teamRequestState(r);
      return <article key={key} className="card" style={{ borderLeft: state === "pending" ? "4px solid var(--logo-yellow)" : undefined }}>
        <small>{t("ad.req.kind." + r.kind)}{r.ref_no ? ` · #${r.ref_no}` : ""} · {formatDateIn(r.created_at, lang)} · {t("ad.req.state." + state)}</small>
        <strong>{r.title}</strong>
        {r.amount != null && <span>{formatPrice(r.amount)}</span>}
        {r.details && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{r.details}</p>}
        <span>👤 {t("ad.req.from")}: <strong>{r.requester_name}</strong> → {t("ad.req.to")}: <strong>{r.counterpart_name}</strong></span>
        {(r.phone || r.delivery_text || r.delivery_lat != null) && <span>🔒 {t("ad.req.private")}:{r.phone ? " 📞 " + r.phone : ""}{r.delivery_text ? " · 📍 " + r.delivery_text : ""}
          {r.delivery_lat != null && r.delivery_lng != null && <> · <a href={mapsUrl({ lat: r.delivery_lat, lng: r.delivery_lng })} target="_blank" rel="noopener">{t("ad.req.map")}</a></>}</span>}
        {r.team_note && <small>🛡️ {r.team_note}</small>}
        {state === "pending" && <div className="stack" style={{ gap: 6 }}>
          <textarea rows={2} value={notes[key] ?? ""} onChange={e => setNotes(n => ({ ...n, [key]: e.target.value }))} placeholder={t("ad.req.note")} aria-label={t("ad.req.note")} />
          {(r.phone || r.delivery_text || r.delivery_lat != null) && <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" checked={!!share[key]} onChange={e => setShare(s => ({ ...s, [key]: e.target.checked }))} style={{ width: 22, height: 22 }} /> {t("ad.req.share")}</label>}
          <div className="row">
            <button disabled={busy} onClick={() => run(() => forwardTeamRequest(supabase(), r.kind, r.id, notes[key] ?? "", !!share[key]), t("ad.req.ok_forwarded"))}>➡️ {t("ad.req.forward", { name: r.counterpart_name })}</button>
            <button className="danger" disabled={busy} onClick={() => {
              const reason = (notes[key] ?? "").trim();
              if (!reason) { setErr(t("ad.req.reason_needed")); return; }
              if (confirm(t("ad.req.confirm_decline"))) void run(() => declineTeamRequest(supabase(), r.kind, r.id, reason), t("ad.req.ok_declined"));
            }}>{t("ad.req.decline")}</button>
          </div>
        </div>}
      </article>;
    })}
  </section>;
}
