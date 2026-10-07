import type { SupabaseClient } from "@supabase/supabase-js";

/** Marketplace: produtos, carrinho e encomendas — mesma lógica no Site e na APP. */

export type ProductInput = { name: string; description?: string; price: number; stock: number; categoryId?: string; municipalityId?: string; businessId?: string; media?: string[]; active?: boolean };
export type Fulfillment = "delivery" | "pickup";
export type PaymentMethod = "cash_on_delivery" | "bank_transfer" | "mobile_money" | "reference";
export type OrderStatus = "pending" | "confirmed" | "processing" | "ready" | "completed" | "cancelled";

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash_on_delivery: "Pagar na entrega", bank_transfer: "Transferência bancária", mobile_money: "Multicaixa Express", reference: "Pagamento por referência"
};
export const FULFILLMENT_LABELS: Record<Fulfillment, string> = { delivery: "Entrega", pickup: "Levantar no vendedor" };
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pendente", confirmed: "Confirmada", processing: "Em preparação", ready: "Pronta", completed: "Concluída", cancelled: "Cancelada"
};
/** Próximo passo que o vendedor pode dar. */
export const NEXT_SELLER_STATUS: Partial<Record<OrderStatus, OrderStatus>> = { pending: "confirmed", confirmed: "processing", processing: "ready", ready: "completed" };
export const MAX_PRODUCT_PHOTOS = 6;

export function validateProductInput(input: ProductInput): string | null {
  if (!input.name.trim()) return "Indique o nome do produto.";
  if (input.name.trim().length > 120) return "O nome é demasiado longo.";
  if (!Number.isFinite(input.price) || input.price <= 0) return "Indique um preço válido.";
  if (!Number.isInteger(input.stock) || input.stock < 0) return "Indique a quantidade em stock (número inteiro).";
  if (!input.categoryId) return "Escolha a categoria.";
  if (!input.municipalityId) return "Escolha o município.";
  if ((input.media?.length ?? 0) > MAX_PRODUCT_PHOTOS) return `Pode juntar no máximo ${MAX_PRODUCT_PHOTOS} fotografias.`;
  return null;
}

export type CheckoutInput = { fulfillment: Fulfillment; paymentMethod: PaymentMethod; phone: string; deliveryText?: string; note?: string };
export function validateCheckout(input: CheckoutInput): string | null {
  if (!/^\+?[0-9 ]{9,15}$/.test(input.phone.trim())) return "Indique um telefone válido para o vendedor o contactar.";
  if (input.fulfillment === "delivery" && !input.deliveryText?.trim()) return "Indique a morada ou ponto de referência para a entrega.";
  return null;
}

/** Agrupa o carrinho por vendedor (cada vendedor recebe a sua encomenda). */
export function groupCartBySeller<T extends { seller_id: string; seller_name: string; line_total: number | string }>(items: T[]) {
  const groups = new Map<string, { sellerId: string; sellerName: string; items: T[]; total: number }>();
  for (const it of items) {
    const g = groups.get(it.seller_id) ?? { sellerId: it.seller_id, sellerName: it.seller_name, items: [], total: 0 };
    g.items.push(it); g.total += Number(it.line_total); groups.set(it.seller_id, g);
  }
  return [...groups.values()];
}

export async function listProducts(client: SupabaseClient, f: { query?: string; categoryId?: string; municipalityId?: string; sellerId?: string; limit?: number } = {}) {
  return client.rpc("product_catalog", { p_query: f.query?.trim() ?? "", p_category_id: f.categoryId || null, p_municipality_id: f.municipalityId || null, p_seller_id: f.sellerId || null, p_limit: f.limit ?? 40 });
}
export async function getProduct(client: SupabaseClient, id: string) {
  return client.from("products").select("id,seller_id,business_id,name,description,category_id,price,currency,stock,media,municipality_id,active,created_at,categories(name),municipalities(name)").eq("id", id).maybeSingle();
}
export async function listMyProducts(client: SupabaseClient, sellerId: string) {
  return client.from("products").select("id,name,price,currency,stock,media,active,category_id,municipality_id,description,business_id").eq("seller_id", sellerId).order("created_at", { ascending: false });
}
export async function saveProduct(client: SupabaseClient, sellerId: string, input: ProductInput, id?: string) {
  const invalid = validateProductInput(input);
  if (invalid) return { data: null, error: new Error(invalid) };
  const row = { seller_id: sellerId, name: input.name.trim(), description: input.description?.trim() || null, price: input.price, stock: input.stock,
    category_id: input.categoryId, municipality_id: input.municipalityId, business_id: input.businessId || null, media: input.media ?? [],
    active: input.active ?? true, updated_at: new Date().toISOString() };
  return id ? client.from("products").update(row).eq("id", id).select().single() : client.from("products").insert(row).select().single();
}
export async function deleteProduct(client: SupabaseClient, id: string) { return client.from("products").delete().eq("id", id); }
export async function listProductCategories(client: SupabaseClient) {
  return client.from("categories").select("id,name").eq("active", true).in("type", ["product", "classified", "business"]).order("name");
}

export async function addToMyCart(client: SupabaseClient, productId: string, quantity = 1) { return client.rpc("cart_add", { p_product_id: productId, p_quantity: quantity }); }
/** Quantidade 0 tira o produto do carrinho (as regras do Supabase só deixam mexer no próprio carrinho). */
export async function setCartQuantity(client: SupabaseClient, productId: string, quantity: number) {
  if (quantity < 1) return client.from("cart_items").delete().eq("product_id", productId);
  return client.rpc("cart_set_quantity", { p_product_id: productId, p_quantity: quantity });
}
export async function getMyCart(client: SupabaseClient) { return client.rpc("cart_contents"); }
export async function placeOrders(client: SupabaseClient, input: CheckoutInput) {
  const invalid = validateCheckout(input);
  if (invalid) return { data: null, error: new Error(invalid) };
  const r = await client.rpc("place_orders", { p_fulfillment: input.fulfillment, p_payment_method: input.paymentMethod, p_contact_phone: input.phone.trim(),
    p_delivery_text: input.deliveryText?.trim() || null, p_note: input.note?.trim() || null });
  // A encomenda já está feita; os artigos ficam marcados como encomendados e saem do carrinho.
  if (!r.error) await client.from("cart_items").delete().not("ordered_at", "is", null);
  return r;
}
export async function listOrders(client: SupabaseClient, role: "buyer" | "seller") { return client.rpc("my_orders", { p_role: role }); }
export async function changeOrderStatus(client: SupabaseClient, orderId: string, status: OrderStatus, paid?: boolean) {
  return client.rpc("update_order_status", { p_order_id: orderId, p_status: status, p_paid: paid ?? null });
}
