import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentMethod, FulfillmentType } from "@huambo-online/types";

export async function setOrderPaymentMethod(client: SupabaseClient, orderId:string, method:PaymentMethod) {
  return client.from("orders").update({payment_method:method,payment_status:"pending"}).eq("id",orderId).select().single();
}

export async function setOrderFulfillment(client: SupabaseClient, orderId:string, type:FulfillmentType, notes?:string) {
  return client.from("orders").update({fulfillment_type:type,delivery_notes:notes||null}).eq("id",orderId).select().single();
}

export async function listMyOrdersWithState(client: SupabaseClient) {
  return client.from("orders").select("id,status,payment_status,payment_method,fulfillment_type,fulfillment_status,currency,subtotal,delivery_fee,total,delivery_address_id,created_at,updated_at").order("created_at",{ascending:false});
}