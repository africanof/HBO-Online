import type { Metadata } from "next";
import { HUAMBO_MUNICIPALITIES, LOCAL_TOPICS, localPath } from "@huambo-online/core";
import { Breadcrumbs, JsonLd, breadcrumbLd } from "../../lib/local";

export const metadata: Metadata = {
  title: "Classificados na província do Huambo — todos os municípios",
  description: "Casas à venda e para arrendar, terrenos, carros, motorizadas e emprego em cada município da província do Huambo: Huambo, Caála, Bailundo, Londuimbali, Longonjo e mais.",
  alternates: { canonical: "/huambo" }
};

/** Índice das páginas locais: cada município com os seus temas. */
export default function HuamboIndex() {
  const crumbs: [string, string][] = [["Início", "/"], ["Província do Huambo", "/huambo"]];
  return <main className="stack">
    <JsonLd data={breadcrumbLd(crumbs)} />
    <Breadcrumbs items={crumbs} />
    <section className="banner blue"><div>
      <h1 style={{ margin: 0 }}>📍 Anúncios em toda a província do Huambo</h1>
      <p>Escolha o município e o que procura: casas, terrenos, carros, motorizadas, emprego ou classificados. A província do Huambo tem 17 municípios e o Huambo Online cobre todos.</p>
    </div></section>
    <div className="results-grid">
      {HUAMBO_MUNICIPALITIES.map(m => <section key={m.slug} className="card stack" style={{ gap: 4 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 20 }}><a href={localPath(m)}>{m.name}</a></h2>
        {LOCAL_TOPICS.map(t => <a key={t.slug} href={localPath(m, t)}>{t.label} {m.at}</a>)}
      </section>)}
    </div>
    <p><a href="/sobre">Sobre o Huambo Online →</a></p>
  </main>;
}
