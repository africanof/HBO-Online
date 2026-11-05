import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as core from "./index";
import { tc, friendlyErrorIn, authErrorIn, mfaErrorIn, CORE_TEXT, CORE_PATTERNS } from "./i18n-core";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Exportações que não são texto para o público (códigos, cores, línguas, dicionários). */
const SKIP_EXPORTS = new Set([
  "LANG_LABELS", "LANG_FLAGS", "LANG_TAGS", "LANGS", "COMMON_DICT", "CORE_TEXT", "CORE_PATTERNS", "BRAND", "PALETTES",
  "LOGO_PARTS", "NEXT_SELLER_STATUS", "PUBLIC_CACHE_TTL", "CHAT_LIMITS", "ANGOLA_BOUNDS",
  // Páginas locais para o Google: só em português (é a língua das pesquisas no Huambo).
  "HUAMBO_MUNICIPALITIES", "LOCAL_TOPICS", "LISTING_CHECKOUT_DICT", "IMPORT_DICT", "CHAT_GUARD_DICT", "ITEM_INSPECTION_DICT"
]);
/** Campos com códigos ou endereços, não texto. */
const SKIP_KEYS = new Set(["value", "key", "href", "path", "slug", "icon", "camera", "subtypes", "gas", "required", "minutes", "updated"]);
/** Nomes próprios, marcas e palavras iguais em inglês. */
const SAME_EN = new Set(["Huambo Online", "Multicaixa Express", "Google Authenticator", "Microsoft Authenticator", "Authy",
  "Hotel", "Resort", "Lodge", "Menu", "Cash & carry", "🔴 Live", "kg"]);
const SAME_ZH = new Set(["Huambo Online", "Multicaixa Express", "Google Authenticator", "Microsoft Authenticator", "Authy"]);

/** Parece texto em português (e não um código como «in_transit», «/loja» ou «#3665F3»)? */
function looksPortuguese(v: string): boolean {
  if (!/[A-Za-zÀ-ÿ]/.test(v)) return false;
  if (/^#[0-9A-Fa-f]{3,8}$/.test(v)) return false;
  if (/^[a-z0-9_\-/.:+?=]+$/.test(v)) return false;
  if (/^(https?:)?\//.test(v)) return false;
  return true;
}
function collect(v: unknown, at: string, out: [string, string][]) {
  if (typeof v === "string") { if (looksPortuguese(v)) out.push([at, v]); return; }
  if (Array.isArray(v)) { v.forEach((x, i) => collect(x, `${at}[${i}]`, out)); return; }
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (!SKIP_KEYS.has(k)) collect(x, `${at}.${k}`, out);
}
function checkTranslated(list: [string, string][]) {
  const bad: string[] = [];
  for (const [at, v] of list) {
    if (tc(v, "en") === v && !SAME_EN.has(v)) bad.push(`en ${at}: ${v}`);
    if (tc(v, "zh") === v && !SAME_ZH.has(v)) bad.push(`zh ${at}: ${v}`);
  }
  return bad;
}

describe("tc — etiquetas e listas exportadas pelo core", () => {
  it("todas as etiquetas, listas, passos e opções exportadas têm inglês e chinês", () => {
    const list: [string, string][] = [];
    let maps = 0;
    for (const [name, v] of Object.entries(core)) {
      if (SKIP_EXPORTS.has(name) || typeof v === "function" || v instanceof RegExp) continue;
      if (typeof v === "string") { collect(v, name, list); continue; }
      if (Array.isArray(v) || (v && typeof v === "object")) { maps++; collect(v, name, list); }
    }
    expect(maps).toBeGreaterThan(80);
    expect(list.length).toBeGreaterThan(500);
    expect(checkTranslated(list)).toEqual([]);
  });

  it("as páginas de informação (termos, privacidade, apagar conta, devoluções) estão traduzidas", () => {
    const list: [string, string][] = [];
    for (const page of [core.termsPage(), core.privacyPage(), core.deleteAccountPage(), core.returnsPage()]) {
      collect({ title: page.title, intro: page.intro, sections: page.sections }, page.slug, list);
    }
    expect(list.length).toBeGreaterThan(100);
    expect(checkTranslated(list)).toEqual([]);
    expect(tc(core.contactLine("apoio@exemplo.ao"), "en")).toBe("You can contact us by email at apoio@exemplo.ao.");
    expect(tc(core.contactLine("apoio@exemplo.ao"), "fr")).toBe("Vous pouvez nous contacter par e-mail à apoio@exemplo.ao.");
  });

  it("devolve o texto como está em português, para null/vazio e para textos desconhecidos", () => {
    expect(tc("Rascunho", "pt")).toBe("Rascunho");
    expect(tc(null, "en")).toBeNull();
    expect(tc(undefined, "zh")).toBeUndefined();
    expect(tc("", "en")).toBe("");
    expect(tc("Casa T3 no Bairro Académico", "en")).toBe("Casa T3 no Bairro Académico");
    expect(tc(core.STATUS_LABELS.sold, "en")).toBe("Sold");
    expect(tc(core.STATUS_LABELS.sold, "zh")).toBe("已售出");
    expect(tc(core.STATUS_LABELS.sold, "fr")).toBe("Vendu");
    expect(tc(core.timeAgo(new Date(Date.now() - 180 * 60000).toISOString()), "fr")).toBe("il y a 3 h");
    expect(tc(core.memberSince("2026-10-01T00:00:00Z"), "fr")).toBe("Membre depuis oct. 2026");
  });

  it("as traduções não estão vazias e mantêm emojis e valores em Kz", () => {
    for (const [pt, t] of Object.entries(CORE_TEXT)) {
      expect(t.en.trim(), pt).not.toBe("");
      expect(t.zh.trim(), pt).not.toBe("");
      expect(t.fr?.trim(), `fr: ${pt}`).toBeTruthy();
      for (const m of pt.match(/\p{Extended_Pictographic}/gu) ?? []) {
        expect(t.en, pt).toContain(m);
        expect(t.zh, pt).toContain(m);
        expect(t.fr, pt).toContain(m);
      }
      for (const kz of pt.match(/\d[\d ]* Kz/g) ?? []) { expect(t.en, pt).toContain(kz); expect(t.fr, pt).toContain(kz); }
    }
    for (const p of CORE_PATTERNS) {
      expect(p.re.source.startsWith("^") && p.re.source.endsWith("$"), String(p.re)).toBe(true);
      expect(p.fr?.trim(), `fr: ${p.re}`).toBeTruthy();
      expect([...(p.fr ?? "").matchAll(/\$\d/g)].map(m => m[0]).sort(), `fr: ${p.re}`).toEqual([...p.en.matchAll(/\$\d/g)].map(m => m[0]).sort());
    }
  });
});

describe("mensagens de erro", () => {
  const src = fs.readFileSync(path.join(here, "classified-listings.ts"), "utf8");
  const block = src.slice(src.indexOf("const errorMessages"), src.indexOf("];", src.indexOf("const errorMessages")));
  const messages = [...block.matchAll(/\[\/(.*)\/[a-z]*,\s*(["`])(.*)\2\],?\s*$/gm)].map(m =>
    m[3].replace("${CLASSIFIED_MAX_PHOTOS}", String(core.CLASSIFIED_MAX_PHOTOS)));

  it("todas as mensagens da tabela do friendlyError têm inglês e chinês", () => {
    expect(messages.length).toBeGreaterThan(240);
    const bad = messages.filter(m => tc(m, "en") === m || tc(m, "zh") === m);
    expect(bad).toEqual([]);
    expect(tc(core.friendlyError(null), "en")).toBe("The operation could not be completed.");
  });

  it("friendlyErrorIn traduz a partir do código de erro do Supabase", () => {
    expect(friendlyErrorIn(new Error("TICKET_ORDER_OPEN"), "en")).toBe("You already have an unpaid booking for this event. Pay or cancel it in «My tickets».");
    expect(friendlyErrorIn({ message: "new row violates row-level security" }, "zh")).toBe("您无权执行此操作。请重新登录。");
    expect(friendlyErrorIn(new Error("TOO_MANY_PHOTOS"), "en")).toBe("You can add up to 10 photos.");
    expect(friendlyErrorIn(new Error("TICKET_ORDER_OPEN"), "pt")).toBe(core.friendlyError(new Error("TICKET_ORDER_OPEN")));
    expect(friendlyErrorIn(new Error("algo estranho"), "en")).toBe("algo estranho");
  });

  it("authErrorIn e mfaErrorIn cobrem todas as mensagens", () => {
    const auth = ["Invalid login credentials", "Email not confirmed", "User already registered", "Password should be at least 6", "rate limit",
      "Database error saving new user", "invalid email", "Failed to fetch", ""];
    for (const raw of auth) {
      const pt = core.authErrorMessage(new Error(raw));
      expect(authErrorIn(new Error(raw), "en"), raw).not.toBe(pt);
      expect(authErrorIn(new Error(raw), "zh"), raw).not.toBe(pt);
    }
    expect(authErrorIn(new Error("Password should be at least 6"), "en")).toBe("The password is weak. Use at least 8 characters.");
    for (const raw of ["Invalid TOTP code", "too many requests", "MFA is disabled", "maximum number of verified factors", "AAL2 required", ""]) {
      const pt = core.mfaErrorMessage(new Error(raw));
      expect(mfaErrorIn(new Error(raw), "en"), raw).not.toBe(pt);
      expect(mfaErrorIn(new Error(raw), "zh"), raw).not.toBe(pt);
    }
    expect(tc(core.validateNewPassword("123", "123"), "en")).toBe("The password must have at least 8 characters.");
    expect(tc(core.validateTotpCode("12"), "zh")).toBe("请输入身份验证器应用中显示的6位数字。");
  });

  it("os validate* devolvem mensagens traduzidas", () => {
    const outs = [
      core.validateClassifiedDraft({ title: "", listingType: "product", purpose: "sale" } as any),
      core.validateClassifiedDraft({ title: "Mesa", listingType: "product", purpose: "sale", provinceId: "p", municipalityId: "m", photoCount: 11 } as any),
      core.validateBudget(10, 5), core.validateAuctionInput({ startingPrice: 0, days: 3 }), core.validateNewPassword("abcdefgh", "x"),
      core.validatePayoutAmount(0, 0, 0), core.validatePayoutAmount(5000, 1000, 0), core.validatePayoutAmount(100, 1000, 500)
    ];
    for (const m of outs) {
      expect(m).toBeTruthy();
      expect(tc(m!, "en"), m!).not.toBe(m);
      expect(tc(m!, "zh"), m!).not.toBe(m);
    }
  });
});

describe("CORE_PATTERNS — textos com partes variáveis", () => {
  const now = Date.parse("2026-10-16T12:00:00Z");
  const ago = (min: number) => new Date(now - min * 60000).toISOString();

  it("tempo: timeAgo, minutesAgoText, timeLeftText, timeLeft, draftAgeText", () => {
    expect(tc(core.timeAgo(ago(0), now), "en")).toBe("just now");
    expect(tc(core.timeAgo(ago(25), now), "en")).toBe("25 min ago");
    expect(tc(core.timeAgo(ago(180), now), "zh")).toBe("3小时前");
    expect(tc(core.timeAgo(ago(3 * 1440), now), "en")).toBe("3 days ago");
    expect(tc(core.timeLeftText(new Date(now + 5 * 3600000).toISOString(), now), "en")).toBe("5 hours left");
    expect(tc(core.timeLeftText(new Date(now + 3 * 86400000).toISOString(), now), "zh")).toBe("还剩3天");
    expect(tc(core.timeLeft(new Date(now + (2 * 24 + 4) * 3600000).toISOString(), now), "zh")).toBe("2天4小时");
    expect(tc(core.draftAgeText(now - 5 * 60000, now), "en")).toBe("saved 5 min ago");
    expect(tc(core.offlineNotice(now - 3 * 86400000, now), "en")).toBe("📡 No internet — showing what was saved 3 days ago.");
  });

  it("preços: formatBudget, listingPriceLabel, agroPriceLabel, fuelPriceText, priceFromText", () => {
    expect(tc(core.formatPrice(null), "en")).toBe("Price on request");
    expect(tc(core.formatBudget(null, 25000), "en")).toBe("up to 25 000 Kz");
    expect(tc(core.formatBudget(20000, null), "zh")).toBe("20 000 Kz起");
    expect(tc(core.formatBudget(null, null), "en")).toBe("Budget to be agreed");
    expect(tc(core.fuelPriceText("gasolina", 300), "en")).toBe("300 Kz / litre");
    expect(tc(core.priceFromText(1500), "en")).toBe("From 1 500 Kz");
    expect(tc(core.agroPriceLabel(12000, { category: "cereais", unit: "saco50", quantity: null, availableFrom: null }), "en")).toBe("12 000 Kz / 50 kg bag");
    expect(tc(core.agroSummary({ category: "cereais", unit: "saco50", quantity: 200, availableFrom: "2026-11-01" }, "2026-10-16"), "en"))
      .toBe("🌽 Cereals · 200 50 kg bags available · Available from 01/11/2026");
  });

  it("payoutDaysText, planSummary e escrowBuyerStep", () => {
    expect(tc(core.payoutDaysText([1, 5]), "en")).toBe("Mondays and Fridays");
    expect(tc(core.payoutDaysText([1, 3, 5]), "zh")).toBe("周一、周三和周五");
    expect(tc(core.payoutDaysText([2]), "en")).toBe("Tuesdays");
    expect(tc(core.payoutDaysText([]), "en")).toBe("on working days");
    const plan = core.planSummary({ state: "trial", active_until: "2026-11-12T00:00:00Z", monthly_price: 2000 } as any, now);
    expect(tc(plan, "en")).toMatch(/^Free until 12\/11\/2026 \(\d+ days left\)\. Then: 2 000 Kz per month\.$/);
    const step = core.escrowBuyerStep({ protected: true, escrow_status: "awaiting_payment", status: "pending", total: 15000,
      pay_by: new Date(now + 5 * 3600000).toISOString() } as any, false, now);
    expect(tc(step, "en")).toBe("Pay 15 000 Kz to Huambo Online (5 hours left). Without payment in time, the order is cancelled.");
  });

  it("estatísticas, seguidores, praças e avaliações", () => {
    expect(tc(core.contactsBreakdown({ messages: 5, whatsapp: 1, calls: 0, offers: 1, orders: 0, shares: 2 }), "en"))
      .toBe("5 messages · 1 WhatsApp · 1 offer · 2 shares");
    expect(tc(core.contactRateText(100, 3)!, "en")).toBe("3 in every 100 people who viewed got in touch.");
    expect(tc(core.periodLabel(14), "zh")).toBe("最近14天");
    expect(tc(core.followersText(1200), "en")).toBe("1 200 followers");
    expect(tc(core.marketSummary({ listings: 3, products: 1, businesses: 0 } as any), "en")).toBe("3 listings · 1 product");
    expect(tc(core.memberSince("2026-10-01T00:00:00Z"), "zh")).toBe("2026年10月加入");
    expect(tc(core.boostOfferText(null), "en")).toBe("⭐ Feature for 500 Kz (7 days)");
  });

  it("combustível e reservas", () => {
    expect(tc(core.fuelStatusLine({ status: "available", status_at: ago(180), queue: "short" } as any, now), "en"))
      .toBe("🟢 Available · updated 3 h ago · Short queue");
    expect(tc(core.fuelReportsText(3, 1), "en")).toBe("3 confirmed it's available · 1 said it ran out (last 2 h)");
    expect(tc(core.fuelQuantityText("gas_12kg", 2), "en")).toBe("2 bottles");
    expect(tc(core.venueFeeNotice(5), "en")).toBe("The total includes a 5% Huambo Online service fee. You pay everything to the venue (on site or to the venue's account).");
    expect(tc(core.venueAvailabilityText({ available: true, free: 3, unit: null } as any, "hotel"), "en")).toBe("🟢 3 rooms free");
    expect(tc(core.ticketsLeftText(4), "zh")).toBe("最后4张门票");
  });

  it("administração: jobQueueText e auditLabel", () => {
    expect(tc(core.jobQueueText({ pending: 0, oldest_pending_seconds: null, done_last_hour: 12, failed: 2 }), "en"))
      .toBe("✅ Notification queue up to date · 12 handled in the last hour · ❌ 2 failed");
    expect(tc(core.jobQueueText({ pending: 5, oldest_pending_seconds: 600, done_last_hour: 1, failed: 0 }), "zh"))
      .toBe("⚠️ 队列延迟：5条待发送（已延迟10分钟） · 最近一小时处理了1条");
    expect(tc(core.auditLabel({ action: "hide", target_type: "classified_listings", details: {} } as any), "en")).toBe("Hid listing");
    expect(tc(core.auditLabel({ action: "update", target_type: "profiles", details: { status: "suspended" } } as any), "en"))
      .toBe("Changed account: status → suspended");
    expect(tc(core.auditLabel({ action: "verification_approved", target_type: "identity", details: {} } as any), "zh")).toBe("批准了认证：身份");
  });
});

describe("notificações e textos curtos", () => {
  it("títulos das notificações do Supabase e padrões com nomes", () => {
    expect(tc("⛽ Nova reserva", "en")).toBe("⛽ New reservation");
    expect(tc("Estabelecimento aprovado ✔", "zh")).toBe("商家已通过审核 ✔");
    expect(tc("Verificação aprovada ✔", "en")).toBe("Verification approved ✔");
    expect(tc("Comissão paga ✔", "en")).toBe("Commission paid ✔");
    expect(tc("Pedido cancelado", "en")).toBe("Order cancelled");
    expect(tc("⛽ Pagamento confirmado — código CB-AB12CD", "en")).toBe("⛽ Payment confirmed — code CB-AB12CD");
    expect(tc("🔴 Live de Loja da Maria", "en")).toBe("🔴 Live stream by Loja da Maria");
    expect(tc("Novo produto de uma loja que segue", "en")).toBe("New product from a shop you follow");
    expect(tc("3 novos anúncios encontrados", "zh")).toBe("发现3条新信息");
  });

  it("listingPriceLabel, offerLabel, ratingLabel, claimDeadlineText, sellerSummary", () => {
    expect(tc(core.listingPriceLabel({ purpose: "sale", price: null, sale_mode: "trade" }), "en")).toBe("🔁 Swap");
    expect(tc(core.listingPriceLabel({ purpose: "wanted", price: 30000 }), "en")).toBe("up to 30 000 Kz");
    expect(tc(core.offerLabel({ amount: 75000, trade_item: "Samsung A10" }), "en")).toBe("75 000 Kz + swap for Samsung A10");
    expect(tc(core.ratingLabel(null, 0), "zh")).toBe("暂无评价");
    expect(tc(core.claimDeadlineText("2026-10-20T10:00:00Z")!, "en")).toBe("You can make a claim until 20/10/2026.");
    expect(tc(core.plural(23, "venda", "vendas"), "en")).toBe("23 sales");
    expect(tc(core.followButtonLabel(true), "en")).toBe("✔ Following");
  });
});
