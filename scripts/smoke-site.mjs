// Teste rápido do site publicado (só leitura: não cria contas nem dados).
// Uso: SITE_URL=https://huambo-na-m-o.onrender.com node scripts/smoke-site.mjs
import { chromium } from "playwright";

const SITE = (process.env.SITE_URL || "https://huambo-na-m-o.onrender.com").replace(/\/$/, "");
const pages = [
  { path: "/", expect: "Compre, venda e encontre tudo no Huambo" },
  { path: "/explorar", expect: "Classificados", options: "select" },
  { path: "/pracas", expect: "Praças do Huambo" },
  { path: "/pagina-que-nao-existe", expect: "Página não encontrada", status: 404 },
  { path: "/classificados/publicar", expect: "Publicar anúncio" },
  { path: "/profissionais", expect: "Profissionais e serviços", options: "select" },
  { path: "/empresas", expect: "Empresas e lojas", options: "select" },
  { path: "/loja", expect: "Loja", options: "select" },
  { path: "/conta/login", expect: "Entrar" },
  { path: "/conta/criar", expect: "Criar conta" },
  { path: "/historico", expect: "Vistos recentemente" },
  { path: "/avaliacoes", expect: "Inicie sessão" },
  { path: "/servicos", expect: "Inicie sessão" }
];
const badText = [/Serviço indisponível/i, /configuração do Supabase em falta/i, /permission denied/i, /Application error/i, /row-level security/i];

const browser = await chromium.launch();
let failures = 0;
// O Render gratuito adormece: a primeira visita pode demorar ~1 minuto.
const warm = await browser.newPage();
try { await warm.goto(SITE + "/", { timeout: 120000, waitUntil: "domcontentloaded" }); } catch (e) { console.log("Aviso ao acordar o site:", e.message); }
await warm.close();

for (const p of pages) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("response", r => { if (r.url().includes(".supabase.co") && r.status() >= 400) errors.push(`Supabase ${r.status()} ${r.url().split("?")[0]}`); });
  let ok = true; const notes = [];
  try {
    const res = await page.goto(SITE + p.path, { timeout: 90000, waitUntil: "networkidle" });
    if (!res || (res.status() >= 400 && res.status() !== (p.status ?? 0))) { ok = false; notes.push("HTTP " + (res ? res.status() : "sem resposta")); }
    const text = await page.innerText("body");
    if (!text.includes(p.expect)) { ok = false; notes.push(`não encontrou «${p.expect}»`); }
    for (const re of badText) if (re.test(text)) { ok = false; notes.push("mensagem de erro: " + re); }
    if (p.options) {
      const counts = await page.$$eval("select", els => els.map(e => e.options.length));
      const max = Math.max(0, ...counts);
      notes.push(`listas carregadas do Supabase: ${counts.join(",") || "nenhuma"}`);
      if (max <= 1) { ok = false; notes.push("as listas (categorias/municípios) vieram vazias — Supabase inacessível?"); }
    }
  } catch (e) { ok = false; notes.push("erro: " + e.message); }
  if (errors.length) { ok = false; notes.push("erros: " + errors.slice(0, 3).join(" | ")); }
  console.log(`${ok ? "✅" : "❌"} ${p.path} — ${notes.join("; ")}`);
  if (!ok) { failures++; await page.screenshot({ path: `smoke${p.path.replace(/\//g, "_") || "_home"}.png`, fullPage: true }).catch(() => {}); }
  await page.close();
}
await browser.close();
console.log(failures ? `\n${failures} página(s) com problemas.` : "\nTodas as páginas OK.");
process.exit(failures ? 1 : 0);
