// Gera as imagens das redes sociais (Playwright): node docs/marketing/redes-sociais/gerar-imagens.js
const { chromium } = require('playwright');
const OUT = '/home/user/HBO-Online/docs/marketing/redes-sociais/';
const B = '#3665F3', BD = '#2148C9', R = '#C7102E', Y = '#F5AF02', YL = '#B88200', G = '#0B7A3B';
const font = `font-family: Inter, 'Noto Color Emoji', sans-serif;`;
const logo = (size, dark = false) => `<span style="font-weight:900;font-size:${size}px;letter-spacing:-0.02em;white-space:nowrap">
  <span style="color:${dark ? '#fff' : B}">Huambo</span><span style="color:${dark ? '#FF8A97' : R}">On</span><span style="color:${dark ? Y : YL}">li</span><span style="color:${dark ? '#5EE39A' : G}">ne</span></span>`;
const stripe = `<div style="position:absolute;left:0;right:0;bottom:0;height:14px;display:flex"><div style="flex:1;background:${B}"></div><div style="flex:1;background:${R}"></div><div style="flex:1;background:${Y}"></div><div style="flex:1;background:${G}"></div></div>`;
const page = (w, h, body, bg = '#fff') => `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0}body{width:${w}px;height:${h}px;overflow:hidden;background:${bg};${font};position:relative}</style></head><body>${body}</body></html>`;

const profile = page(1080, 1080, `<div style="position:absolute;inset:0;background:${B};display:flex;align-items:center;justify-content:center">
  <div style="color:#fff;font-weight:900;font-size:620px;line-height:1;margin-top:40px">H</div>
  <div style="position:absolute;width:150px;height:150px;border-radius:50%;background:${Y};top:250px;right:250px"></div></div>`);

const cover = (w, h, opts = {}) => {
  const s = opts.scale ?? 1;
  return page(w, h, `<div style="position:absolute;inset:0;background:linear-gradient(120deg,#fff 0%,#fff 52%,${'#EEF2FE'} 52%)"></div>
  <div style="position:absolute;left:${opts.left ?? 80}px;top:50%;transform:translateY(-50%);max-width:${opts.textW ?? 900}px">
    ${logo(110 * s)}
    <div style="font-size:${46 * s}px;font-weight:800;color:#191919;margin-top:${14 * s}px;line-height:1.15">Compre, venda e encontre tudo no Huambo.</div>
    <div style="font-size:${30 * s}px;color:#595959;margin-top:${14 * s}px">Classificados · Loja · Serviços · Eventos · Importação</div>
    <div style="display:inline-block;margin-top:${22 * s}px;background:${B};color:#fff;font-weight:800;font-size:${30 * s}px;padding:${12 * s}px ${30 * s}px;border-radius:999px">huamboonline.com</div>
  </div>
  <div style="position:absolute;right:${opts.right ?? 70}px;top:50%;transform:translateY(-50%);display:grid;grid-template-columns:repeat(3,${150 * s}px);gap:${20 * s}px">
    ${['🏠','🚗','🌾','💼','🛍️','✈️','⛽','🎟️','🛡️'].map(e => `<div style="width:${150*s}px;height:${150*s}px;border-radius:${36*s}px;background:#fff;box-shadow:0 6px 20px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center;font-size:${80*s}px">${e}</div>`).join('')}
  </div>${stripe}`);
};

const post = (emoji, title, text, bullets, color = B) => page(1080, 1350, `
  <div style="position:absolute;inset:0;background:${color}"></div>
  <div style="position:absolute;left:70px;right:70px;top:70px;display:flex;justify-content:space-between;align-items:center">
    <div style="background:#fff;border-radius:999px;padding:14px 30px">${logo(44)}</div>
    <div style="font-size:120px">${emoji}</div></div>
  <div style="position:absolute;left:70px;right:70px;top:300px;color:#fff">
    <div style="font-size:84px;font-weight:900;line-height:1.05">${title}</div>
    <div style="font-size:40px;margin-top:28px;line-height:1.3;opacity:.95">${text}</div>
    <div style="margin-top:40px;display:grid;gap:18px">${bullets.map(b => `<div style="background:rgba(255,255,255,.16);border-radius:22px;padding:20px 26px;font-size:36px;font-weight:700">${b}</div>`).join('')}</div></div>
  <div style="position:absolute;left:70px;right:70px;bottom:60px;display:flex;justify-content:space-between;align-items:center;color:#fff">
    <div style="font-size:38px;font-weight:800">huamboonline.com</div><div style="font-size:30px;opacity:.9">📲 APP na Play Store</div></div>`);

const story = page(1080, 1920, `<div style="position:absolute;inset:0;background:${B}"></div>
  <div style="position:absolute;top:260px;left:0;right:0;text-align:center"><div style="display:inline-block;background:#fff;border-radius:999px;padding:24px 50px">${logo(84)}</div></div>
  <div style="position:absolute;top:560px;left:80px;right:80px;color:#fff;text-align:center">
    <div style="font-size:110px;font-weight:900;line-height:1.05">Já chegou ao Huambo!</div>
    <div style="font-size:48px;margin-top:40px;line-height:1.3">Compre, venda e encontre tudo, com pagamento protegido.</div>
    <div style="font-size:140px;margin-top:60px">🏠 🚗 🌾 🛍️ ✈️</div></div>
  <div style="position:absolute;bottom:260px;left:0;right:0;text-align:center"><div style="display:inline-block;background:${Y};color:#191919;font-weight:900;font-size:56px;padding:28px 60px;border-radius:999px">huamboonline.com</div></div>`);

const jobs = [
  ['perfil-1080.png', profile, 1080, 1080],
  ['capa-facebook-1640x624.png', cover(1640, 624, { scale: 0.75, left: 190, right: 180, textW: 820 }), 1640, 624],
  ['capa-linkedin-1584x396.png', cover(1584, 396, { scale: 0.55, left: 420, right: 60, textW: 760 }), 1584, 396],
  ['capa-youtube-2560x1440.png', cover(2560, 1440, { scale: 0.9, left: 520, right: 520, textW: 900 }), 2560, 1440],
  ['capa-x-1500x500.png', cover(1500, 500, { scale: 0.68, left: 60, right: 50, textW: 880 }), 1500, 500],
  ['post-1-lancamento.png', post('🎉', 'O Huambo Online chegou!', 'O mercado do Huambo, agora no telemóvel e no computador.', ['🏠 Casas, terrenos e carros', '🛍️ Loja, praças e profissionais', '🛡️ Pagamento protegido em tudo']), 1080, 1350],
  ['post-2-pagamento-protegido.png', post('🛡️', 'Compre sem medo de burlas', 'Paga ao Huambo Online. O vendedor só recebe depois de confirmar que recebeu.', ['✅ Dinheiro guardado até receber', '↩️ Se correr mal, devolvemos', '🚫 Nunca pague fora da plataforma'], G), 1080, 1350],
  ['post-3-vender-gratis.png', post('📸', 'Venda em 2 minutos', 'Tire fotografias, escreva o preço e publique. É grátis.', ['🤖 A IA ajuda a escrever o anúncio', '💬 Receba mensagens de compradores', '🔨 Preço fixo, propostas ou leilão'], R), 1080, 1350],
  ['post-4-importacao.png', post('✈️', 'Compramos por si no exterior', 'Diga-nos o que procura. Nós encontramos, compramos e trazemos até ao Huambo.', ['🇨🇳 China · 🇦🇪 Dubai · 🇵🇹 Portugal · 🇧🇷 Brasil', '💬 Orçamento com tudo incluído', '📦 Acompanhe até à entrega'], BD), 1080, 1350],
  ['post-5-combustivel.png', post('⛽', 'Onde há combustível e gás?', 'Veja os postos com stock perto de si e reserve o seu gás pela APP.', ['📍 Postos e filas atualizados', '🔔 Aviso quando chegar', '🧾 Pague e levante com o código'], '#B35C00'), 1080, 1350],
  ['post-6-servicos.png', post('👷', 'Encontre quem resolve', 'Eletricistas, explicadores, canalizadores, empresas e muito mais no Huambo.', ['⭐ Avaliações de clientes reais', '💬 Peça orçamento pela APP', '🛡️ Pague com pagamento protegido'], '#5B3CC4'), 1080, 1350],
  ['story-1080x1920.png', story, 1080, 1920],
];
(async () => {
  const b = await chromium.launch();
  for (const [name, html, w, h] of jobs) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await p.setContent(html); await p.waitForTimeout(300);
    await p.screenshot({ path: OUT + name });
    await p.close();
  }
  await b.close();
})();
