import type { Metadata } from "next";
import { HUAMBO_MUNICIPALITIES, LOCAL_TOPICS, localPath } from "@huambo-online/core";
import { Breadcrumbs, JsonLd, breadcrumbLd } from "../../lib/local";
import { SITE_URL } from "../../lib/site";
import { DEFAULT_OG_IMAGES } from "../../lib/site";

export const metadata: Metadata = {
  title: "Sobre o Huambo Online — o marketplace da província do Huambo",
  description: "O Huambo Online junta num só sítio classificados, imóveis, viaturas, emprego, loja online, profissionais, empresas e praças da província do Huambo, Angola.",
  alternates: { canonical: "/sobre" },
  openGraph: { images: DEFAULT_OG_IMAGES, title: "Sobre o Huambo Online", description: "O marketplace da província do Huambo, Angola.", url: "/sobre", siteName: "Huambo Online", locale: "pt_AO", type: "website" }
};

const FAQ: [string, string][] = [
  ["Publicar um anúncio no Huambo Online custa dinheiro?", "Não. Publicar anúncios de venda, arrendamento, troca e «Procura-se» é grátis. Só são pagos os destaques opcionais, que põem o anúncio no topo."],
  ["Em que zonas funciona o Huambo Online?", "Em toda a província do Huambo: cidade do Huambo, Caála, Bailundo, Londuimbali, Longonjo, Mungo, Ucuma, Ecunha, Cachiungo e todos os outros municípios."],
  ["Como compro com segurança?", "Fale com o vendedor pelas Mensagens do Huambo Online, veja o artigo antes de pagar, encontre-se num local público e, na Loja, use o pagamento protegido: o dinheiro só chega ao vendedor depois de receber a encomenda."],
  ["Há aplicação para telemóvel?", "Sim. Além do Site, o Huambo Online tem aplicação para Android, com as mesmas funções e um modo «Poupar dados» para gastar menos saldo."]
];

/** Página «Sobre»: o que é o Huambo Online e a província que serve (ajuda o Google a ligar «Huambo» ao Site). */
export default function Sobre() {
  const crumbs: [string, string][] = [["Início", "/"], ["Sobre o Huambo Online", "/sobre"]];
  const ld = [breadcrumbLd(crumbs),
    { "@context": "https://schema.org", "@type": "AboutPage", name: "Sobre o Huambo Online", url: SITE_URL + "/sobre",
      about: { "@type": "Organization", name: "Huambo Online", url: SITE_URL, logo: SITE_URL + "/icon.svg", areaServed: { "@type": "AdministrativeArea", name: "Província do Huambo, Angola" } } },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }];

  return <main className="stack" style={{ maxWidth: 860 }}>
    <JsonLd data={ld} />
    <Breadcrumbs items={crumbs} />
    <h1 style={{ margin: 0 }}>Sobre o Huambo Online</h1>
    <p style={{ fontSize: 18, margin: 0 }}>O <strong>Huambo Online</strong> é o marketplace da <strong>província do Huambo</strong>, em Angola: um só sítio para comprar, vender,
      arrendar, trocar, procurar emprego e encontrar quem faz o serviço de que precisa, perto de casa.</p>

    <h2 style={{ margin: "8px 0 0" }}>O que encontra no Huambo Online</h2>
    <ul style={{ margin: 0, lineHeight: 1.6 }}>
      <li><a href="/explorar">Classificados</a>: telemóveis, eletrodomésticos, móveis, roupa, produtos agrícolas e muito mais, à venda, em troca ou em leilão.</li>
      <li><a href="/imoveis">Imóveis</a>: casas, apartamentos, vivendas, terrenos, lojas e armazéns para vender ou arrendar.</li>
      <li><a href="/viaturas">Viaturas</a>: carros, jipes, pick-ups, camiões e motorizadas.</li>
      <li><a href="/emprego">Emprego e estágios</a>: vagas de empresas e particulares, com o CV enviado pelas Mensagens.</li>
      <li><a href="/loja">Loja online</a>: produtos de lojas e armazéns do Huambo, com entrega e pagamento protegido.</li>
      <li><a href="/profissionais">Profissionais</a> e <a href="/empresas">empresas</a>: eletricistas, canalizadores, pedreiros, mecânicos, explicadores, restaurantes, hotéis e muito mais.</li>
      <li><a href="/pracas">Praças</a>: o que se vende hoje nas praças do Kapango, do Ferro, de Cacilhas e de outros mercados da província.</li>
      <li><a href="/agricultura">Agricultura</a>, <a href="/eventos">eventos e bilhetes</a>, <a href="/combustivel">combustível e gás</a> e <a href="/reservas">reservas</a>.</li>
    </ul>

    <h2 style={{ margin: "8px 0 0" }}>A província do Huambo</h2>
    <p style={{ margin: 0 }}>A província do Huambo fica no Planalto Central de Angola. A cidade do Huambo, a capital, é um dos maiores centros urbanos do país, com universidades,
      comércio e serviços, e é atravessada pelo Caminho de Ferro de Benguela. A província é uma das grandes regiões agrícolas de Angola: milho, feijão, batata, hortícolas
      e fruta chegam todos os dias às praças. Tem 17 municípios, e o Huambo Online tem uma página para cada um:</p>
    <div className="row">{HUAMBO_MUNICIPALITIES.map(m => <a key={m.slug} className="chip" href={localPath(m)}>{m.name}</a>)}</div>

    <h2 style={{ margin: "8px 0 0" }}>O que mais se procura no Huambo</h2>
    <div className="row">{LOCAL_TOPICS.map(t => <a key={t.slug} className="chip" href={localPath(HUAMBO_MUNICIPALITIES[0], t)}>{t.icon} {t.label} no Huambo</a>)}</div>

    <h2 style={{ margin: "8px 0 0" }}>Comprar e vender com segurança</h2>
    <ul style={{ margin: 0, lineHeight: 1.6 }}>
      <li>Converse sempre pelas Mensagens do Huambo Online: avisamos quando uma mensagem parece burla.</li>
      <li>Veja o artigo antes de pagar e encontre-se num local público, de dia. Há <a href="/seguranca">pontos de encontro seguros</a> sugeridos.</li>
      <li>Na Loja, o pagamento é protegido: o dinheiro só chega ao vendedor depois de confirmar que recebeu.</li>
      <li>Prefira vendedores com perfil verificado e boas <a href="/avaliacoes">avaliações</a>, e denuncie anúncios suspeitos.</li>
    </ul>

    <h2 style={{ margin: "8px 0 0" }}>Perguntas frequentes</h2>
    {FAQ.map(([q, a]) => <details key={q} className="card"><summary style={{ fontWeight: 700, cursor: "pointer" }}>{q}</summary><p style={{ margin: "8px 0 0" }}>{a}</p></details>)}

    <section className="banner blue">
      <div><h2>Comece já</h2><p>Publique o seu primeiro anúncio em minutos, com fotografias tiradas no telemóvel.</p></div>
      <a className="btn" href="/classificados/publicar">+ Publicar grátis</a>
    </section>
    <p style={{ margin: 0 }}>Mais: <a href="/ajuda">Ajuda</a> · <a href="/termos">Termos</a> · <a href="/privacidade">Privacidade</a></p>
  </main>;
}
