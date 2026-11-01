// Acessibilidade do site publicado (WCAG 2 A/AA) com o axe — só leitura, não cria dados.
// Uso: npm install --no-save playwright@1 axe-core@4 && SITE_URL=https://huambo-online.vercel.app node scripts/a11y-site.mjs
import { chromium } from "playwright";
import { createRequire } from "node:module";
import fs from "node:fs";

const SITE = (process.env.SITE_URL || "https://huambo-online.vercel.app").replace(/\/$/, "");
const axe = fs.readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const pages = ["/", "/explorar", "/loja", "/profissionais", "/empresas", "/pracas", "/procura-se", "/trocas",
  "/ajuda", "/termos", "/privacidade", "/apagar-conta", "/conta/login", "/conta/criar", "/classificados/publicar"];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } }); // telemóvel
let problems = 0;
for (const path of pages) {
  const page = await ctx.newPage();
  try {
    await page.goto(SITE + path, { timeout: 120000, waitUntil: "networkidle" });
    await page.addScriptTag({ content: axe });
    const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] })).violations
      .map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map(n => n.target.join(" ")) })));
    if (violations.length) { problems += violations.length; console.log(`❌ ${path}`); for (const v of violations) console.log(`   ${v.impact} ${v.id}: ${v.help}\n     ${v.nodes.join("\n     ")}`); }
    else console.log(`✅ ${path}`);
  } catch (e) { problems++; console.log(`❌ ${path} — erro: ${e.message}`); }
  await page.close();
}
await browser.close();
console.log(problems ? `\n${problems} problema(s) de acessibilidade.` : "\nSem problemas de acessibilidade.");
process.exit(problems ? 1 : 0);
