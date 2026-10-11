"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getClassifiedListing, contactListingOwner, isClassifiedListingSaved, saveClassifiedListing, removeClassifiedListing,
  reportClassifiedListing, getPublicProfile, formatPrice, friendlyError, listingTerritory, LISTING_TYPE_LABELS, PURPOSE_LABELS, STATUS_LABELS } from "@huambo-online/core";
import { supabase } from "../../../lib/supabase";
import { ShareButton, useRecordView } from "../../../components/Engage";
import { RentalRequestForm, AuctionPanel } from "../../../components/ListingExtras";
import { AUCTIONABLE_TYPES } from "@huambo-online/core";

export default function ClassifiedDetail() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<any>(null);
  const [place, setPlace] = useState("");
  const [seller, setSeller] = useState("");
  const [uid, setUid] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(0);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const c = supabase();
      const r = await getClassifiedListing(c, id);
      if (r.error) { setError(friendlyError(r.error)); return; }
      if (!r.data) { setError("Anúncio não encontrado ou já não está publicado."); return; }
      setItem(r.data);
      const t = listingTerritory(r.data);
      if (t.municipalityId) {
        const m = await c.from("municipalities").select("name,provinces(name)").eq("id", t.municipalityId).maybeSingle();
        if (m.data) setPlace(m.data.name + ((m.data as any).provinces?.name ? ", " + (m.data as any).provinces.name : ""));
      }
      const p = await getPublicProfile(c, r.data.owner_id);
      if (p.data?.full_name) setSeller(p.data.full_name);
      const u = await c.auth.getUser();
      if (u.data.user) {
        setUid(u.data.user.id);
        const s = await isClassifiedListingSaved(c, u.data.user.id, id);
        if (s.data) setSavedId(s.data.id);
      }
    })();
  }, [id]);

  useRecordView("listing", item?.status === "published" ? id : undefined, item?.title, Array.isArray(item?.media) ? item.media[0] : null);

  async function toggleSaved() {
    if (!uid) { setError("Inicie sessão para guardar este anúncio."); return; }
    setBusy(true);
    const c = supabase();
    const r = savedId ? await removeClassifiedListing(c, uid, id) : await saveClassifiedListing(c, uid, id);
    setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else setSavedId(savedId ? null : (r.data as any)?.id ?? "saved");
  }

  async function contact() {
    if (!uid) { setError("Inicie sessão para contactar o anunciante."); return; }
    if (!message.trim() || busy) return;
    setBusy(true); setError("");
    const r = await contactListingOwner(supabase(), id, message);
    setBusy(false);
    if (r.error) { setError(friendlyError(r.error)); return; }
    setMessage("");
    const conversationId = (r.data as any)?.id;
    if (conversationId) window.location.href = "/mensagens?conversation=" + conversationId;
    else setNotice("Mensagem enviada.");
  }

  async function report() {
    if (!uid) { setError("Inicie sessão para denunciar."); return; }
    if (!reason.trim()) { setError("Indique o motivo da denúncia."); return; }
    const r = await reportClassifiedListing(supabase(), id, reason);
    if (r.error) setError(friendlyError(r.error)); else { setNotice("Denúncia enviada. Obrigado."); setReporting(false); setReason(""); }
  }

  if (error && !item) return <main><a href="/explorar">← Explorar</a><h1>Anúncio</h1><p className="error">{error}</p></main>;
  if (!item) return <main><p>A carregar anúncio…</p></main>;
  const media: string[] = Array.isArray(item.media) ? item.media : [];
  const mine = uid === item.owner_id;

  const typeLabel = LISTING_TYPE_LABELS[item.listing_type as keyof typeof LISTING_TYPE_LABELS] ?? item.listing_type;
  const purposeLabel = PURPOSE_LABELS[item.purpose as keyof typeof PURPOSE_LABELS] ?? item.purpose;

  return <main className="stack">
    <a href={"/explorar?tipo=" + item.listing_type}>← Classificados › {typeLabel}</a>
    {item.status !== "published" && <p className="badge">{STATUS_LABELS[item.status as keyof typeof STATUS_LABELS] ?? item.status} — só você vê este anúncio</p>}
    <div className="itempage">
      <section className="gallery" aria-label="Fotografias">
        {media.length === 0 ? <div className="gallery-empty" aria-hidden>🏷️</div> : <>
          <div className="thumbs">{media.length > 1 && media.map((m, i) => <button key={m} type="button" aria-current={i === photo} onClick={() => setPhoto(i)} aria-label={`Ver fotografia ${i + 1}`}><img src={m} alt="" /></button>)}</div>
          <img className="gallery-main" src={media[photo]} alt={`Fotografia ${photo + 1} de ${media.length}`} style={media.length === 1 ? { gridColumn: "1 / -1" } : undefined} />
        </>}
      </section>
      <section className="buybox">
        <h1>{item.title}</h1>
        {seller && <div className="seller-box"><span aria-hidden style={{ fontSize: 30 }}>👤</span><span>Anunciante: <a href={"/vendedor/" + item.owner_id}><strong>{seller}</strong></a><br /><a href={"/vendedor/" + item.owner_id} style={{ fontWeight: 400, fontSize: 15 }}>Ver outros anúncios</a></span></div>}
        <div className="big-price">{formatPrice(item.price, item.currency)}</div>
        <dl className="facts">
          <dt>Tipo</dt><dd>{typeLabel}</dd>
          <dt>Finalidade</dt><dd>{purposeLabel}</dd>
          {place && <><dt>Local</dt><dd>📍 {place}</dd></>}
        </dl>
        {notice && <p className="ok" role="status">{notice}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {item.status === "published" && <AuctionPanel listingId={id} uid={uid} mine={mine} canStart={["sale", "auction"].includes(item.purpose) && AUCTIONABLE_TYPES.includes(item.listing_type)} />}
        {!mine && item.status === "published" && ["rent", "lease"].includes(item.purpose) && <RentalRequestForm listingId={id} uid={uid} defaultPrice={item.price} />}
        <div className="actions">
          {mine ? <><a className="btn" href={`/classificados/${id}/editar`}>Editar anúncio</a><a className="btn secondary" href="/meus-anuncios">Os meus anúncios</a></> : <>
            <a className="btn" href="#contactar">💬 Contactar anunciante</a>
            <button type="button" className="secondary" onClick={toggleSaved} disabled={busy}>{savedId ? "♥ Guardado" : "♡ Guardar anúncio"}</button>
          </>}
          {item.status === "published" && <ShareButton kind="listing" id={id} title={item.title} />}
        </div>
      </section>
    </div>
    {item.description && <section className="card"><h2 style={{ margin: 0 }}>Descrição</h2><p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{item.description}</p></section>}
    {!mine && <>
      <section className="card" id="contactar">
        <h2 style={{ margin: 0 }}>Contactar anunciante</h2>
        <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Olá, o anúncio ainda está disponível?" rows={4} />
        <button type="button" disabled={busy || !message.trim()} onClick={contact} style={{ justifySelf: "start" }}>{busy ? "A enviar…" : "Enviar mensagem"}</button>
      </section>
      {!reporting ? <button type="button" className="secondary" onClick={() => setReporting(true)} style={{ justifySelf: "start" }}>Denunciar anúncio</button> :
        <section className="card"><label>Motivo da denúncia<textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Ex.: fraude, conteúdo proibido…" /></label>
          <div className="row"><button type="button" className="danger" onClick={report}>Enviar denúncia</button><button type="button" className="secondary" onClick={() => setReporting(false)}>Cancelar</button></div></section>}
    </>}
  </main>;
}
