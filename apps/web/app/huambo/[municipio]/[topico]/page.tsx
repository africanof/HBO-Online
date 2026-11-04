import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HUAMBO_MUNICIPALITIES, LOCAL_TOPICS, localMunicipality, localTopic, localPath, localSeo, isExampleName } from "@huambo-online/core";
import { Breadcrumbs, JsonLd, ListingGrid, breadcrumbLd, localListings, municipalityId } from "../../../../lib/local";
import { SITE_URL } from "../../../../lib/site";

export const revalidate = 1800; // os anúncios atualizam de meia em meia hora
export const dynamicParams = false;
export function generateStaticParams() {
  return HUAMBO_MUNICIPALITIES.flatMap(m => LOCAL_TOPICS.map(t => ({ municipio: m.slug, topico: t.slug })));
}

type P = { params: Promise<{ municipio: string; topico: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { municipio, topico } = await params;
  const m = localMunicipality(municipio), t = localTopic(topico);
  if (!m || !t) return {};
  const s = localSeo(m, t), path = localPath(m, t);
  return { title: s.title, description: s.description, alternates: { canonical: path },
    openGraph: { title: s.title, description: s.description, url: path, siteName: "Huambo Online", locale: "pt_AO", type: "website" } };
}

/** «Casas à venda na Caála», «Emprego no Bailundo»…: texto próprio + anúncios dessa zona. */
export default async function LocalTopicPage({ params }: P) {
  const { municipio, topico } = await params;
  const m = localMunicipality(municipio), t = localTopic(topico);
  if (!m || !t) notFound();
  const s = localSeo(m, t);
  const mId = await municipalityId(m);
  const here = mId ? await localListings(t, mId) : [];
  const elsewhere = here.length < 6 ? (await localListings(t, null, 12)).filter(x => !here.some(h => h.id === x.id)) : [];
  const crumbs: [string, string][] = [["Início", "/"], ["Província do Huambo", "/huambo"], [m.name, localPath(m)], [t.label, localPath(m, t)]];
  const real = here.filter(x => !isExampleName(x.title));
  const ld = [breadcrumbLd(crumbs), { "@context": "https://schema.org", "@type": "CollectionPage", name: s.title, description: s.description, url: SITE_URL + localPath(m, t),
    ...(real.length ? { mainEntity: { "@type": "ItemList", itemListElement: real.map((x, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/classificados/${x.id}`, name: x.title })) } } : {}) }];

  return <main className="stack">
    <JsonLd data={ld} />
    <Breadcrumbs items={crumbs} />
    <section className="banner blue">
      <div><h1 style={{ margin: 0 }}>{t.icon} {s.title}</h1>
        <p>{t.intro}</p></div>
      <a className="btn" href={t.publish}>+ Publicar grátis</a>
    </section>

    {here.length > 0
      ? <><h2 style={{ margin: 0 }}>{here.length === 1 ? "1 anúncio" : `${here.length} anúncios`} {m.at}</h2><ListingGrid items={here} /></>
      : <div className="card"><strong>Ainda não há anúncios de «{t.label.toLowerCase()}» {m.at}.</strong>
          <p style={{ margin: "6px 0 0" }}>Seja o primeiro: publicar é grátis e o seu anúncio aparece aqui e no Google. <a href={t.publish}>Publicar agora →</a></p></div>}
    {elsewhere.length > 0 && <><h2 style={{ margin: "8px 0 0" }}>Noutros municípios do Huambo</h2><ListingGrid items={elsewhere} /></>}
    <p><a href={t.more}>Ver todos os anúncios de {t.label.toLowerCase()} no Huambo Online →</a></p>

    <section className="stack" style={{ gap: 8 }}>
      <h2 style={{ margin: 0 }}>Sobre {m.slug === "huambo" ? "a cidade do Huambo" : m.name}</h2>
      <p style={{ margin: 0 }}>{m.about}</p>
      <p style={{ margin: 0 }}>No Huambo Online encontra {t.label.toLowerCase()} {m.at} e em todos os municípios da província do Huambo. Fale com o vendedor pelas Mensagens,
        combine um ponto de encontro seguro e, nas compras da Loja, use o pagamento protegido: o dinheiro só chega ao vendedor depois de receber. <a href="/seguranca">Dicas de segurança</a>.</p>
    </section>

    <nav aria-label={`Mais anúncios ${m.at}`} className="stack" style={{ gap: 8 }}>
      <h2 style={{ margin: 0 }}>Mais {m.at}</h2>
      <div className="row">{LOCAL_TOPICS.filter(x => x.slug !== t.slug).map(x => <a key={x.slug} className="chip" href={localPath(m, x)}>{x.icon} {x.label}</a>)}</div>
    </nav>
    <nav aria-label={`${t.label} noutros municípios`} className="stack" style={{ gap: 8 }}>
      <h2 style={{ margin: 0 }}>{t.label} noutros municípios</h2>
      <div className="row">{HUAMBO_MUNICIPALITIES.filter(x => x.slug !== m.slug).map(x => <a key={x.slug} className="chip" href={localPath(x, t)}>{x.name}</a>)}</div>
    </nav>
  </main>;
}
