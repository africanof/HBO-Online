"use client";
import { useEffect, useMemo, useState } from "react";
import { listMyVerificationsV2, requestVerification, requestIdentityVerification, uploadVerificationDocument, validateDocument, validateIdentityRequest,
  normalizeBiNumber, listMyBusinesses, getProvider, friendlyErrorIn, IDENTITY_SHOTS,
  VERIFICATION_KIND_LABELS, VERIFICATION_STATUS_LABELS, type MyVerificationV2, type VerificationKind, type IdentityShot } from "@huambo-online/core";
import { supabase, currentUserId } from "../../../lib/supabase";
import { useT, formatDateIn } from "../../../lib/i18n";
import { CameraCapture } from "../../../components/CameraCapture";


/** BI frente, BI verso e selfie com o BI — tudo tirado na hora com a câmara — mais o número do BI. */
function IdentityForm({ uid, onSent }: { uid: string; onSent: () => Promise<void> }) {
  const { lang, t, tc } = useT();
  const [shots, setShots] = useState<Partial<Record<IdentityShot, Blob>>>({});
  const [step, setStep] = useState(0); // 0..2 = a tirar a fotografia; 3 = todas tiradas
  const [idNumber, setIdNumber] = useState(""); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const urls = useMemo(() => Object.fromEntries(Object.entries(shots).map(([k, b]) => [k, URL.createObjectURL(b as Blob)])) as Partial<Record<IdentityShot, string>>, [shots]);
  useEffect(() => () => Object.values(urls).forEach(u => u && URL.revokeObjectURL(u)), [urls]);

  function use(key: IdentityShot, blob: Blob) {
    const next = { ...shots, [key]: blob }; setShots(next); setError("");
    const missing = IDENTITY_SHOTS.findIndex(s => !next[s.key]);
    setStep(missing === -1 ? 3 : missing);
  }
  async function send() {
    const bad = validateIdentityRequest({ ...shots, idNumber }); if (bad) { setError(tc(bad)); return; }
    setBusy(true); setError("");
    const r = await requestIdentityVerification(supabase(), uid, shots as Record<IdentityShot, Blob>, idNumber, note);
    setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang, t("sv.vf_req_fail"))); return; }
    setShots({}); setIdNumber(""); setNote(""); setStep(0); await onSent();
  }
  const bi = normalizeBiNumber(idNumber);
  const done = IDENTITY_SHOTS.filter(s => shots[s.key]);
  return <div className="stack">
    <ol style={{ margin: 0, paddingLeft: 22 }}>
      {IDENTITY_SHOTS.map((s, i) => <li key={s.key} aria-current={step === i ? "step" : undefined} style={{ fontWeight: step === i ? 800 : 400 }}>{tc(s.title).replace(/^\d\.\s*/, "")} {shots[s.key] ? "✔" : ""}</li>)}
    </ol>
    <p style={{ margin: 0 }}>📷 {t("sv.vf_camera_only")}</p>
    {done.length > 0 && <div className="id-shots">
      {done.map(s => <figure key={s.key} className="id-shot">
        <button type="button" onClick={() => setStep(IDENTITY_SHOTS.indexOf(s))} aria-label={t("sv.vf_retake", { title: tc(s.title) })}>
          <img src={urls[s.key]} alt={tc(s.title)} />
        </button>
        <figcaption>{tc(s.title)} ✔</figcaption>
      </figure>)}
    </div>}
    {step < 3 && <CameraCapture shot={IDENTITY_SHOTS[step]} onUse={b => use(IDENTITY_SHOTS[step].key, b)}
      onCancel={done.length === 3 ? () => setStep(3) : undefined} />}
    {step === 3 && <>
      <label>{t("sv.vf_bi_number")}
        <input value={idNumber} onChange={e => setIdNumber(e.target.value.toUpperCase())} placeholder="004512345LA042" autoComplete="off" autoCapitalize="characters"
          spellCheck={false} maxLength={20} aria-describedby="bi-help" aria-invalid={idNumber.length > 0 && !bi} />
      </label>
      <small id="bi-help">{idNumber && !bi ? t("sv.vf_bi_bad") : bi ? "✔ " + t("sv.vf_bi_ok") : t("sv.vf_bi_help")}</small>
      <label>{t("sv.vf_note")}<textarea rows={2} value={note} onChange={e => setNote(e.target.value)} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" disabled={busy} onClick={send}>{busy ? t("sv.sending") : t("sv.vf_send")}</button>
    </>}
    {step < 3 && error && <p className="error" role="alert">{error}</p>}
  </div>;
}

export default function Verificacao() {
  const { lang, t, tc } = useT();
  const SENT = t("sv.vf_sent");
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<MyVerificationV2[]>([]); const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]); const [isProvider, setIsProvider] = useState(false);
  const [kind, setKind] = useState<VerificationKind>("identity"); const [businessId, setBusinessId] = useState(""); const [file, setFile] = useState<File | null>(null); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");

  async function load(id: string) {
    const c = supabase();
    const [v, b, p] = await Promise.all([listMyVerificationsV2(c), listMyBusinesses(c, id), getProvider(c, id)]);
    setItems(v.data); setBusinesses(((b.data as any[]) ?? []).map(x => ({ id: x.id, name: x.name }))); setIsProvider(!!p.data);
  }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(id); }); }, []);

  async function send() {
    if (!uid) return;
    if (!file) { setError(t("sv.vf_choose_file")); return; }
    const v = validateDocument({ size: file.size, type: file.type }); if (v) { setError(tc(v)); return; }
    if (kind === "business" && !businessId) { setError(t("sv.vf_choose_biz")); return; }
    setBusy(true); setError(""); setNotice("");
    const c = supabase();
    const up = await uploadVerificationDocument(c, uid, file, file.name, file.type);
    if (up.error || !up.data) { setBusy(false); setError(friendlyErrorIn(up.error, lang, t("sv.vf_doc_fail"))); return; }
    const r = await requestVerification(c, kind, up.data, { businessId: kind === "business" ? businessId : undefined, note });
    setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    setNotice(SENT); setFile(null); setNote(""); await load(uid);
  }

  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main><a href="/conta">← {t("sv.your_account")}</a><h1>{t("sv.vf_title")}</h1><p><a href="/conta/login?voltar=/conta/verificacao">{t("sv.login_link")}</a>.</p></main>;
  const kinds: VerificationKind[] = ["identity", ...(isProvider ? ["provider" as const] : []), ...(businesses.length ? ["business" as const] : [])];
  const identity = items.find(v => v.kind === "identity" && v.status === "approved") ?? items.find(v => v.kind === "identity" && v.status === "pending");
  return <main className="stack" style={{ maxWidth: 760 }}>
    <a href="/conta">← {t("sv.your_account")}</a>
    <h1>✔ {t("sv.vf_title")}</h1>
    <p>{t("sv.vf_intro_a")} <span className="verified">✔ {t("common.verified")}</span> {t("sv.vf_intro_b")}</p>
    <p style={{ margin: 0 }}>🔒 {t("sv.vf_private")}</p>
    <section className="card">
      <strong>{t("sv.vf_what")}</strong>
      <div className="row">{kinds.map(k => <button key={k} type="button" aria-pressed={kind === k} className={kind === k ? "" : "secondary"} onClick={() => { setKind(k); setError(""); setNotice(""); }}>{tc(VERIFICATION_KIND_LABELS[k])}</button>)}</div>
      {notice && <p className="ok" role="status">{notice}</p>}
      {kind === "identity" ? identity
        ? <p className={identity.status === "approved" ? "ok" : undefined} role="status" style={{ margin: 0 }}>
            {identity.status === "approved" ? "✔ " + t("sv.vf_id_ok") : "⏳ " + t("sv.vf_id_pending")}
          </p>
        : <IdentityForm uid={uid} onSent={async () => { setNotice(SENT); await load(uid); }} />
      : <>
        {kind === "business" && <label>{t("sv.vf_business")}<select value={businessId} onChange={e => setBusinessId(e.target.value)}><option value="">{t("sv.choose")}</option>{businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
        <label>{kind === "business" ? t("sv.vf_biz_doc") : t("sv.vf_id_doc")}
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
        <label>{t("sv.vf_note")}<textarea rows={2} value={note} onChange={e => setNote(e.target.value)} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button disabled={busy} onClick={send}>{busy ? t("sv.sending") : t("sv.vf_send")}</button>
      </>}
    </section>
    <h2>{t("sv.vf_mine")}</h2>
    {items.length === 0 && <p>{t("sv.vf_none")}</p>}
    {items.map(v => <article key={v.id} className="card">
      <strong>{tc(VERIFICATION_KIND_LABELS[v.kind])}{v.business_name ? " — " + v.business_name : ""} · <span className="badge">{tc(VERIFICATION_STATUS_LABELS[v.status])}</span></strong>
      {v.id_number_hint && <span>{t("sv.vf_bi_number")}: {v.id_number_hint}</span>}
      {v.admin_note && <span>{t("sv.vf_admin_note")}: {v.admin_note}</span>}
      <small>{formatDateIn(v.created_at, lang)}</small>
    </article>)}
  </main>;
}
