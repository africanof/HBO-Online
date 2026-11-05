import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HUAMBO_MUNICIPALITIES, LOCAL_TOPICS, localMunicipality, localPath, localSeo, localTopic } from "@huambo-online/core";
import { Breadcrumbs, JsonLd, ListingGrid, breadcrumbLd, localListings, municipalityId } from "../../../lib/local";
import { DEFAULT_OG_IMAGES } from "../../../lib/site";

export const revalidate = 1800;
export const dynamicParams = false;
export function generateStaticParams() { return HUAMBO_MUNICIPALITIES.map(m => ({ municipio: m.slug })); }

type P = { params: Promise<{ municipio: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const m = localMunicipality((await params).municipio);
  if (!m) return {};
  const s = localSeo(m), path = localPath(m);
  return { title: s.title, description: s.description, alternates: { canonical: path },
    openGraph: { images: DEFAULT_OG_IMAGES, title: s.title, description: s.description, url: path, siteName: "Huambo Online", locale: "pt_AO", type: "website" } };
}

/** Página de um município: o que há para comprar, arrendar e trabalhar lá. */
export default async function MunicipalityPage({ params }: P) {
  const m = localMunicipality((await params).municipio);
  if (!m) notFound();
  const s = localSeo(m);
  const mId = await municipalityId(m);
  const latest = mId ? await localListings(localTopic("classificados")!, mId, 12) : [];
  const crumbs: [string, string][] = [["Início", "/"], ["Província do Huambo", "/huambo"], [m.name, localPath(m)]];

  return <main className="stack">
    <JsonLd data={breadcrumbLd(crumbs)} />
    <Breadcrumbs items={crumbs} />
    <section className="banner blue">
      <div><h1 style={{ margin: 0 }}>📍 {s.title}</h1><p>{m.about}</p></div>
      <a className="btn" href="/classificados/publicar">+ Publicar grátis</a>
    </section>
    <nav aria-label={`Anúncios ${m.at}`} className="results-grid">
      {LOCAL_TOPICS.map(t => <a key={t.slug} className="card" href={localPath(m, t)} style={{ textDecoration: "none", color: "inherit" }}>
        <strong style={{ fontSize: 18 }}>{t.icon} {t.label} {m.at}</strong><span style={{ display: "block", marginTop: 6, color: "var(--muted)" }}>{t.intro.split(".")[0]}.</span></a>)}
    </nav>
    {latest.length > 0 && <><h2 style={{ margin: 0 }}>Anúncios recentes {m.at}</h2><ListingGrid items={latest} /></>}
    <section className="stack" style={{ gap: 8 }}>
      <h2 style={{ margin: 0 }}>Comprar e vender {m.at}</h2>
      <p style={{ margin: 0 }}>O Huambo Online é o marketplace da província do Huambo. {m.at[0].toUpperCase() + m.at.slice(1)} pode publicar anúncios grátis de casas, terrenos, carros,
        motorizadas, telemóveis, produtos agrícolas e serviços, procurar emprego e encontrar profissionais e empresas perto de si. <a href="/sobre">Saiba mais sobre o Huambo Online</a>.</p>
    </section>
    <nav aria-label="Outros municípios" className="stack" style={{ gap: 8 }}>
      <h2 style={{ margin: 0 }}>Outros municípios da província</h2>
      <div className="row">{HUAMBO_MUNICIPALITIES.filter(x => x.slug !== m.slug).map(x => <a key={x.slug} className="chip" href={localPath(x)}>{x.name}</a>)}</div>
    </nav>
  </main>;
}
