import { describe, expect, it } from "vitest";
import { auditLabel, documentPath, submitReport, reportTargetHref, requestVerification, trustBadges, validateDocument, validateReport,
  replyToReview, decideVerification, setTargetActive, ADMIN_STAT_LABELS } from "./index";
import { formatPreferredDate, requestService, quickDates } from "./deal-reviews";
import { friendlyError } from "./classified-listings";

const uuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
function rpcClient() {
  const calls: { fn: string; args: any }[] = [];
  const client: any = { rpc: (fn: string, args: any) => { calls.push({ fn, args }); return Promise.resolve({ data: null, error: null }); } };
  return { client, calls };
}

describe("confiança", () => {
  it("valida denúncias e documentos", () => {
    expect(validateReport(" ")).toMatch(/motivo/);
    expect(validateReport("Burla ou fraude")).toBeNull();
    expect(validateDocument({ type: "application/zip", size: 10 })).toMatch(/PDF/);
    expect(validateDocument({ type: "image/jpeg", size: 6 * 1024 * 1024 })).toMatch(/5 MB/);
    expect(validateDocument({ type: "application/pdf", size: 1000 })).toBeNull();
  });
  it("guarda o documento na pasta da pessoa com um nome seguro", () => {
    expect(documentPath(uuid, "Bilhete de Identidade (frente).JPG", 123)).toBe(`${uuid}/123-Bilhete-de-Identidade-frente-.JPG`);
    expect(documentPath(uuid, "álvara nº 5.pdf", 1)).toBe(`${uuid}/1-alvara-n-5.pdf`);
    expect(documentPath(uuid, "///", 1)).toBe(`${uuid}/1-documento`);
    expect(documentPath(uuid, "x.pdf", 1)).toMatch(/^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/);
  });
  it("mostra os selos e as ligações", () => {
    expect(trustBadges(null)).toEqual([]);
    expect(trustBadges({ identity_verified: true, phone_verified: false, provider_verified: true, businesses_verified: 2 })).toEqual(["✔ Identidade verificada", "✔ Profissional verificado", "✔ Empresa verificada"]);
    expect(reportTargetHref("product", uuid)).toBe("/loja/" + uuid);
    expect(reportTargetHref("user", uuid)).toBe("/vendedor/" + uuid);
    expect(reportTargetHref("provider", uuid)).toBe("/profissionais/" + uuid);
  });
  it("descreve o registo da administração", () => {
    expect(auditLabel({ action: "update", target_type: "profiles", details: { status: "suspended" } })).toBe("Alterou conta: status → suspended");
    expect(auditLabel({ action: "hide", target_type: "product", details: {} })).toBe("Escondeu produto");
    expect(auditLabel({ action: "verification_approved", target_type: "business", details: {} })).toBe("Aprovou a verificação de empresa");
    expect(ADMIN_STAT_LABELS.some(([k]) => k === "verifications_pending")).toBe(true);
  });
  it("usa as funções do servidor", async () => {
    const { client, calls } = rpcClient();
    await submitReport(client, "product", uuid, " Burla ", "");
    await requestVerification(client, "business", `${uuid}/1-a.pdf`, { businessId: uuid });
    await replyToReview(client, "deal", uuid, " Obrigado ");
    await decideVerification(client, uuid, false, "Ilegível");
    await setTargetActive(client, "provider", uuid, false);
    await requestService(client, { providerId: uuid }, "Torneira", "2026-10-20");
    expect(calls.map(c => c.fn)).toEqual(["report_content", "request_verification", "reply_to_review", "admin_decide_verification", "admin_set_target_active", "request_service_v2"]);
    expect(calls[0].args).toEqual({ p_target_type: "product", p_target_id: uuid, p_reason: "Burla", p_details: null });
    expect(calls[1].args.p_business_id).toBe(uuid);
    expect(calls[2].args.p_reply).toBe("Obrigado");
    expect(calls[5].args.p_preferred_date).toBe("2026-10-20");
  });
  it("liga as notificações", async () => {
    const { getNotificationLink } = await import("./notifications");
    expect(getNotificationLink({ type: "system", title: "Nova denúncia", data: { report_id: uuid, for: "admin" } })?.href).toBe("/admin");
    expect(getNotificationLink({ type: "system", title: "Novo pedido de verificação", data: { verification_id: uuid, for: "admin" } })?.href).toBe("/admin");
    expect(getNotificationLink({ type: "system", title: "Verificação aprovada ✔", data: { verification_id: uuid, for: "verification" } })?.href).toBe("/conta/verificacao");
  });
  it("formata a data pretendida e traduz erros", () => {
    expect(formatPreferredDate("2026-10-20")).toBe("Para 20/10/2026");
    expect(formatPreferredDate(null)).toBe("");
    const q = quickDates(3, new Date("2026-10-14T23:30:00Z")); // já é dia 15 em Angola
    expect(q).toEqual([{ value: "2026-10-15", label: "Hoje" }, { value: "2026-10-16", label: "Amanhã" }, { value: "2026-10-17", label: "sáb. 17/10" }]);
    expect(friendlyError({ message: "ALREADY_REPORTED" })).toMatch(/Já denunciou/);
    expect(friendlyError({ message: "VERIFICATION_PENDING" })).toMatch(/à espera/);
    expect(friendlyError({ message: "INVALID_DATE" })).toMatch(/data/);
  });
});
