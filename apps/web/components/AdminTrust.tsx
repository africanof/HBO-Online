"use client";
import { useEffect, useState } from "react";
import { listVerificationsForAdminV2, decideVerification, verificationDocumentUrl, listAudit, auditLabel, friendlyErrorIn, biNumberText, LANG_TAGS, type Lang,
  IDENTITY_ADMIN_CHECKLIST, IDENTITY_REJECT_REASONS,
  VERIFICATION_KIND_LABELS, VERIFICATION_STATUS_LABELS, type AdminVerificationV2, type AuditEntry, type VerificationStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT, formatDateIn } from "../lib/i18n";

/** label = chave do dicionário (ad.photo_*). */
type Photo = { label: string; path: string };
function photosOf(v: AdminVerificationV2): Photo[] {
  if (v.kind !== "identity" || !v.selfie_path) return [];
  return [{ label: "ad.photo_front", path: v.document_path }, ...(v.back_path ? [{ label: "ad.photo_back", path: v.back_path }] : []), { label: "ad.photo_selfie", path: v.selfie_path }];
}
const fmtDate = (d: string | null, lang: Lang) => d ? formatDateIn(d, lang) : "—";

/** As três fotografias lado a lado (ligações temporárias de 10 minutos); tocar abre em grande. */
function IdentityPhotos({ v, onError }: { v: AdminVerificationV2; onError: (m: string) => void }) {
  const { t } = useT();
  const photos = photosOf(v);
  const [urls, setUrls] = useState<(string | null)[]>([]); const [big, setBig] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    void Promise.all(photos.map(p => verificationDocumentUrl(supabase(), p.path))).then(rs => {
      if (!alive) return;
      setUrls(rs.map(r => r.data));
      if (rs.some(r => r.error || !r.data)) onError(t("ad.photos_error"));
    });
    return () => { alive = false; };
  }, [v.id]);
  return <>
    <div className="id-shots">
      {photos.map((p, i) => <figure key={p.label} className="id-shot">
        <button type="button" onClick={() => urls[i] && setBig(i)} disabled={!urls[i]} aria-label={t("ad.view_big", { label: t(p.label) })}>
          {urls[i] ? <img src={urls[i]!} alt={t("ad.photo_of", { label: t(p.label), name: v.user_name })} /> : <span className="lite-ph" aria-hidden>⏳</span>}
        </button>
        <figcaption>{t(p.label)}</figcaption>
      </figure>)}
    </div>
    {big !== null && urls[big] && <div className="lightbox" role="dialog" aria-modal="true" aria-label={t(photos[big].label)} onClick={() => setBig(null)}
      onKeyDown={e => { if (e.key === "Escape") setBig(null); }}>
      <div className="lightbox-inner" onClick={e => e.stopPropagation()}>
        <img src={urls[big]!} alt={t("ad.photo_of", { label: t(photos[big].label), name: v.user_name })} />
        <div className="row">
          <strong>{t(photos[big].label)}</strong>
          <button type="button" className="secondary" onClick={() => setBig((big + photos.length - 1) % photos.length)}>← {t("ad.previous")}</button>
          <button type="button" className="secondary" onClick={() => setBig((big + 1) % photos.length)}>{t("ad.next")} →</button>
          <button type="button" autoFocus onClick={() => setBig(null)}>{t("common.close")}</button>
        </div>
      </div>
    </div>}
  </>;
}

/** Um pedido: dados da conta, fotografias, lista de confirmação e decisão. */
function VerificationCard({ v, onDecided, onError }: { v: AdminVerificationV2; onDecided: (msg: string) => Promise<void>; onError: (m: string) => void }) {
  const { lang, t, tc } = useT();
  const identityV2 = v.kind === "identity" && !!v.selfie_path;
  const [checked, setChecked] = useState<boolean[]>(IDENTITY_ADMIN_CHECKLIST.map(() => false));
  const [rejecting, setRejecting] = useState(false); const [reasons, setReasons] = useState<string[]>([]); const [text, setText] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const allChecked = !identityV2 || checked.every(Boolean);

  async function open(path: string) {
    const r = await verificationDocumentUrl(supabase(), path);
    if (r.error || !r.data) onError(r.error ? friendlyErrorIn(r.error, lang) : t("ad.doc_error")); else window.open(r.data, "_blank", "noopener");
  }
  async function decide(approve: boolean) {
    const note = approve ? "" : [...reasons, text.trim()].filter(Boolean).join(". ");
    if (!approve && !note) { setErr(t("ad.err_need_reason")); return; }
    if (approve && !allChecked) { setErr(t("ad.err_need_checklist")); return; }
    setBusy(true); setErr("");
    const r = await decideVerification(supabase(), v.id, approve, note);
    setBusy(false);
    if (r.error) { setErr(friendlyErrorIn(r.error, lang)); return; }
    await onDecided(approve ? t("ad.ok_verif_approved") : t("ad.ok_verif_rejected"));
  }
  const id = "v-" + v.id;
  return <article className="card" aria-labelledby={id}>
    <strong id={id}>{tc(VERIFICATION_KIND_LABELS[v.kind])}{v.business_name ? " — " + v.business_name : ""} · <span className="badge">{tc(VERIFICATION_STATUS_LABELS[v.status])}</span></strong>
    <span><a href={"/vendedor/" + v.user_id} target="_blank">{v.user_name || t("ad.no_name")}</a>{v.phone ? " · " + v.phone : ""}</span>
    <small>{t("ad.requested_on", { date: new Date(v.created_at).toLocaleString(LANG_TAGS[lang]) })} · {t("ad.account_created_on", { date: fmtDate(v.account_created_at, lang) })}</small>
    {v.kind === "identity" && v.id_number && <span>{t("ad.bi_number")}: <span className="bi-number">{biNumberText(v.id_number)}</span></span>}
    {v.previous_rejections > 0 && <p className="scam-warn" style={{ margin: 0 }}>⚠️ {t(v.previous_rejections === 1 ? "ad.prev_rejections_one" : "ad.prev_rejections_many", { n: v.previous_rejections })}</p>}
    {v.note && <span>{t("ad.note")}: {v.note}</span>}
    {v.admin_note && <span>{t("ad.answer")}: {v.admin_note}</span>}
    {identityV2 ? <IdentityPhotos v={v} onError={onError} /> : <>
      {v.kind === "identity" && <small>{t("ad.old_request")}</small>}
      <div className="row"><button type="button" className="secondary" onClick={() => open(v.document_path)}>📄 {t("ad.view_document")}</button></div>
    </>}
    {v.status === "pending" && <>
      {identityV2 && <fieldset className="checklist">
        <legend style={{ fontWeight: 800, marginBottom: 6 }}>{t("ad.checklist_title")}</legend>
        {IDENTITY_ADMIN_CHECKLIST.map((c, i) => <label key={c}>
          <input type="checkbox" checked={checked[i]} onChange={e => setChecked(checked.map((x, j) => j === i ? e.target.checked : x))} />
          <span>{tc(c)}</span>
        </label>)}
      </fieldset>}
      {rejecting ? <div className="stack" style={{ gap: 8 }}>
        <strong>{t("ad.reject_reason_title")}</strong>
        {v.kind === "identity" && <div className="chips">
          {IDENTITY_REJECT_REASONS.map(r => <button key={r} type="button" className={"chip" + (reasons.includes(r) ? " on" : "")} aria-pressed={reasons.includes(r)}
            onClick={() => setReasons(reasons.includes(r) ? reasons.filter(x => x !== r) : [...reasons, r])}>{tc(r)}</button>)}
        </div>}
        <label>{t("ad.other_reason")}<textarea rows={2} value={text} onChange={e => setText(e.target.value)} /></label>
        <div className="row">
          <button type="button" className="danger" disabled={busy} onClick={() => decide(false)}>✖ {t("ad.confirm_reject")}</button>
          <button type="button" className="secondary" onClick={() => { setRejecting(false); setErr(""); }}>{t("common.back")}</button>
        </div>
      </div> : <div className="row">
        <button type="button" disabled={busy || !allChecked} onClick={() => decide(true)} title={allChecked ? undefined : t("ad.confirm_all_points")}>✔ {t("ad.approve")}</button>
        <button type="button" className="danger" disabled={busy} onClick={() => setRejecting(true)}>✖ {t("ad.reject")}</button>
      </div>}
      {identityV2 && !allChecked && !rejecting && <small>{t("ad.approve_hint", { n: IDENTITY_ADMIN_CHECKLIST.length })}</small>}
      {err && <p className="error" role="alert">{err}</p>}
    </>}
  </article>;
}

/** Pedidos de verificação: ver as fotografias (ligações temporárias) e aprovar ou recusar. */
export function AdminVerifications() {
  const { lang, t, tc } = useT();
  const [status, setStatus] = useState<VerificationStatus | "">("pending");
  const [items, setItems] = useState<AdminVerificationV2[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listVerificationsForAdminV2(supabase(), status); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void load(); }, [status]);
  return <section className="stack">
    <label style={{ maxWidth: 260 }}>{t("ad.status")}<select value={status} onChange={e => setStatus(e.target.value as any)}><option value="">{t("ad.all_m")}</option>{Object.entries(VERIFICATION_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{tc(l)}</option>)}</select></label>
    <p style={{ margin: 0 }}>🔒 {t("ad.photos_private")}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items.length === 0 && <p>{t("ad.no_verifications")}</p>}
    {items.map(v => <VerificationCard key={v.id} v={v} onError={m => setError(m)} onDecided={async m => { setError(""); setNotice(m); await load(); }} />)}
  </section>;
}

/** Registo das ações da administração (só leitura). */
export function AdminAudit() {
  const { lang, t, tc } = useT();
  const [items, setItems] = useState<AuditEntry[]>([]); const [error, setError] = useState("");
  useEffect(() => { void listAudit(supabase(), 200).then(r => { if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }); }, []);
  return <section className="stack">
    <p>{t("ad.audit_intro")}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {items.length === 0 && !error && <p>{t("ad.audit_empty")}</p>}
    {items.map(e => <div key={e.id} className="card"><strong>{tc(auditLabel(e))}</strong><small>{e.actor_name} · {new Date(e.created_at).toLocaleString(LANG_TAGS[lang])}</small></div>)}
  </section>;
}
