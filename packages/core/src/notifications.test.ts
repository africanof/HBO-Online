import {describe,expect,it} from "vitest";
import {getNotificationConversationId,getNotificationDestination,getNotificationListingId,getNotificationSavedSearchId} from "./notifications";

const uuid="550e8400-e29b-41d4-a716-446655440000";
const uuid2="6ba7b810-9dad-41d1-80b4-00c04fd430c8";

describe("notification destinations",()=>{
 it("accepts valid UUID destination ids",()=>{
  const n={data:{conversation_id:uuid,listing_id:uuid2,saved_search_id:"invalid"}};
  expect(getNotificationConversationId(n)).toBe(uuid);
  expect(getNotificationListingId(n)).toBe(uuid2);
  expect(getNotificationSavedSearchId(n)).toBeNull();
 });
 it("prioritizes conversation, then listing, then saved search",()=>{
  expect(getNotificationDestination({data:{conversation_id:uuid,listing_id:uuid2}})).toEqual({kind:"conversation",id:uuid});
  expect(getNotificationDestination({data:{listing_id:uuid2}})).toEqual({kind:"listing",id:uuid2});
  expect(getNotificationDestination({data:{saved_search_id:uuid}})).toEqual({kind:"saved_search",id:uuid});
 });
 it("returns null for malformed or missing data",()=>{
  expect(getNotificationDestination({data:{listing_id:"123"}})).toBeNull();
  expect(getNotificationDestination({data:{}})).toBeNull();
 });
});

import { getNotificationLink } from "./notifications";
describe("notification links", () => {
  it("points orders and reviews to the right page", () => {
    expect(getNotificationLink({ type: "order", title: "Nova encomenda", data: { order_id: uuid } })).toEqual({ href: "/encomendas?vendas=1", label: "📦 Ver venda →" });
    expect(getNotificationLink({ type: "order", title: "Encomenda confirmada", data: { order_id: uuid } })?.href).toBe("/encomendas");
    expect(getNotificationLink({ type: "review", title: "Nova avaliação", data: { provider_id: uuid } })?.href).toBe("/profissionais/" + uuid);
    expect(getNotificationLink({ type: "review", title: "Nova avaliação", data: { business_id: uuid2 } })?.href).toBe("/empresas/" + uuid2);
    expect(getNotificationLink({ type: "message", title: "x", data: {} })).toBeNull();
  });
});
