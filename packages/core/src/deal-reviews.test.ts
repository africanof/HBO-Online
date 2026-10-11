import { describe, expect, it } from "vitest";
import {
  businessStatsRows, confirmService, formatRating, listDealCandidates, listMyServiceRequests, listPendingReviews, memberSince, requestService,
  sellerBadge, serviceActions, setListingDeal, submitDealReview, updateServiceRequest, userStatsRows, validateReview, validateServiceRequest,
  getUserStats, finalDealStatus, type UserStats
} from "./deal-reviews";
import { getNotificationLink } from "./notifications";
import { friendlyError } from "./classified-listings";

const uuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const base: UserStats = {
  seller_rating: null, seller_reviews: 0, buyer_rating: null, buyer_reviews: 0, sales_done: 0, purchases_done: 0, listings_sold: 0,
  listings_active: 0, services_requested: 0, services_done: 0, service_rating: null, service_reviews: 0, member_since: "2026-10-05T10:00:00Z"
};
function rpcClient(data: unknown = null) {
  const calls: { fn: string; args: any }[] = [];
  const client: any = { rpc: (fn: string, args: any) => { calls.push({ fn, args }); return Promise.resolve({ data, error: null }); } };
  return { client, calls };
}

describe("reputação", () => {
  it("mostra o resumo do vendedor", () => {
    expect(sellerBadge(base)).toBe("");
    expect(sellerBadge({ ...base, seller_rating: 4.75 as any, seller_reviews: 12, sales_done: 20, listings_sold: 3 })).toBe("★ 4,8 (12) · 23 vendas");
    expect(sellerBadge({ ...base, listings_sold: 1 })).toBe("1 venda");
    expect(formatRating("4.5")).toBe("4,5");
    expect(formatRating(null)).toBe("");
    expect(memberSince("2026-10-05T10:00:00Z")).toBe("Membro desde out. 2026");
    expect(memberSince(null)).toBe("");
  });
  it("monta os números do perfil", () => {
    const rows = userStatsRows({ ...base, buyer_rating: 5, buyer_reviews: 1, purchases_done: 2, services_requested: 4, services_done: 3 });
    expect(rows.map(r => r.label)).toEqual(["Como comprador", "Vendas concluídas", "Compras concluídas", "Pedidos de serviço recebidos", "Serviços prestados", "Anúncios ativos"]);
    expect(rows[0].value).toBe("★ 5,0 · 1 avaliação");
    expect(userStatsRows(base).some(r => r.label === "Serviços prestados")).toBe(false);
    expect(businessStatsRows({ rating: null, review_count: 0, confirmed_reviews: 0, services_requested: 2, services_done: 1, sales_done: 0, member_since: null })[0].value).toBe("Ainda sem avaliações");
  });
  it("sabe os passos do pedido de serviço", () => {
    expect(serviceActions("requested", "provider")).toEqual(["accept", "decline", "done"]);
    expect(serviceActions("accepted", "provider")).toEqual(["done", "decline"]);
    expect(serviceActions("done", "provider")).toEqual([]);
    expect(serviceActions("requested", "client")).toEqual(["cancel"]);
    expect(serviceActions("done", "client")).toEqual(["confirm"]);
    expect(serviceActions("confirmed", "client")).toEqual([]);
  });
  it("escolhe o estado final do anúncio", () => {
    expect(finalDealStatus("sale")).toBe("sold"); expect(finalDealStatus("auction")).toBe("sold");
    expect(finalDealStatus("rent")).toBe("rented"); expect(finalDealStatus("lease")).toBe("rented");
    expect(finalDealStatus("wanted")).toBe("closed"); expect(finalDealStatus("service")).toBe("closed");
  });
  it("valida antes de enviar", () => {
    expect(validateReview(0)).toMatch(/estrelas/);
    expect(validateReview(4, "Bom")).toBeNull();
    expect(validateServiceRequest(" a ")).toMatch(/Descreva/);
    expect(validateServiceRequest("Instalar 3 tomadas")).toBeNull();
  });
  it("usa as funções do servidor", async () => {
    const { client, calls } = rpcClient([base]);
    expect((await getUserStats(client, uuid)).data?.member_since).toBe(base.member_since);
    await submitDealReview(client, "order", uuid, 5, "  Bom  ");
    await setListingDeal(client, uuid, "sold", uuid);
    await listDealCandidates(client, uuid);
    await requestService(client, { businessId: uuid }, " Pintar ");
    await updateServiceRequest(client, uuid, "accept");
    await confirmService(client, uuid, 4, "");
    await listMyServiceRequests(client, "provider");
    await listPendingReviews(client);
    expect(calls.map(c => c.fn)).toEqual(["public_user_stats", "submit_deal_review", "set_listing_deal", "listing_deal_candidates", "request_service",
      "update_service_request", "confirm_service", "my_service_requests", "my_pending_reviews"]);
    expect(calls[1].args).toEqual({ p_kind: "order", p_ref: uuid, p_rating: 5, p_comment: "Bom" });
    expect(calls[4].args).toEqual({ p_provider_id: null, p_business_id: uuid, p_description: "Pintar" });
    expect(calls[6].args.p_comment).toBeNull();
  });
  it("liga as notificações às páginas certas", () => {
    expect(getNotificationLink({ type: "system", title: "Novo pedido de serviço", data: { service_request_id: uuid, for: "service" } })?.href).toBe("/servicos?recebidos=1");
    expect(getNotificationLink({ type: "review", title: "Serviço confirmado e avaliado", data: { service_request_id: uuid, for: "service" } })?.href).toBe("/servicos");
    expect(getNotificationLink({ type: "system", title: "Negócio concluído — avalie", data: { listing_id: uuid, for: "review" } })?.href).toBe("/avaliacoes");
    expect(getNotificationLink({ type: "review", title: "Recebeu uma avaliação", data: { user_id: uuid, for: "profile" } })?.href).toBe("/vendedor/" + uuid);
  });
  it("traduz os erros", () => {
    expect(friendlyError({ message: "DEAL_NOT_COMPLETED" })).toMatch(/concluído/);
    expect(friendlyError({ message: "NOT_DEAL_PARTY" })).toMatch(/negócio/);
    expect(friendlyError({ message: "CANNOT_REQUEST_OWN_SERVICE" })).toMatch(/si próprio/);
  });
});
