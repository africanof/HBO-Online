"use client";
import { useEffect, useState } from "react";
import { listJobCategories, listJobListings, salaryLabel, isFeatured, friendlyErrorIn, categoryLabelIn, isJobCategorySlug,
  type JobCategory, type JobCategorySlug } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";
import { ItemCard } from "../../components/ItemCard";
import { useT, timeAgoIn } from "../../lib/i18n";

/** Emprego e estágios: vagas das três categorias de emprego, com o CV enviado pelas Mensagens. */
export default function Emprego() {
  const { lang, t, tc } = useT();
  const [cats, setCats] = useState<JobCategory[]>([]);
  const [slug, setSlug] = useState<JobCategorySlug | "">(""); const [q, setQ] = useState("");
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");

  async function load(list = cats, s = slug, query = q) {
    setError("");
    const r = await listJobListings(supabase(), list, { slug: s, query });
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems(r.data);
  }
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("tipo");
    const s = isJobCategorySlug(p) ? p : "";
    setSlug(s);
    void listJobCategories(supabase()).then(r => { setCats(r.data); void load(r.data, s, ""); });
  }, []);
  const slugOf = (categoryId: string) => cats.find(c => c.id === categoryId)?.slug;
  const publishHref = "/classificados/publicar?categoria=" + (slug || "emprego");

  return <main className="stack">
    <a href="/">← {t("nav.home")}</a>
    <section className="banner blue">
      <div><h1 style={{ margin: 0 }}>💼 {t("job.title")}</h1><p>{t("job.intro")}</p></div>
      <a className="btn" href={publishHref}>+ {t("job.publish")}</a>
    </section>
    <form onSubmit={e => { e.preventDefault(); void load(); }} className="row">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("job.search_ph")} style={{ maxWidth: 420 }} aria-label={t("job.search")} />
      <button type="submit">{t("ls.search_btn")}</button>
    </form>
    <div className="row" role="radiogroup" aria-label={t("job.kind")}>
      <button type="button" role="radio" aria-checked={slug === ""} className={"chip" + (slug === "" ? " on" : "")} onClick={() => { setSlug(""); void load(cats, "", q); }}>{t("job.all")}</button>
      {cats.map(c => <button key={c.id} type="button" role="radio" aria-checked={slug === c.slug} className={"chip" + (slug === c.slug ? " on" : "")}
        onClick={() => { setSlug(c.slug); void load(cats, c.slug, q); }}>{categoryLabelIn(c.name, lang)}</button>)}
    </div>
    <p className="muted" style={{ margin: 0 }}>📄 {t("job.cv_hint")}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {items === null && !error && <p>{t("common.loading")}</p>}
    {items?.length === 0 && <div className="card"><strong>{q ? t("job.none_q", { q }) : t("job.none")}</strong><a href={publishHref}>{t("job.be_first")} →</a></div>}
    <div className="results-grid">{items?.map(x => {
      const s = slugOf(x.category_id); const c = cats.find(k => k.id === x.category_id);
      return <ItemCard key={x.id} featured={isFeatured(x)} video={!!x.video_url} href={"/classificados/" + x.id} media={x.media} title={x.title}
        price={tc(salaryLabel(x.price, s, x.currency))} icon="💼" tag={c ? categoryLabelIn(c.name, lang) : undefined}
        meta={timeAgoIn(x.created_at, lang)} />;
    })}</div>
  </main>;
}
