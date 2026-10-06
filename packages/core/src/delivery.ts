import type { SupabaseClient } from "@supabase/supabase-js";

export async function createDeliveryRequest(client:SupabaseClient,input:{orderId:string;requesterId:string;pickupAddressId?:string;dropoffAddressId?:string;notes?:string}){
  return client.from("delivery_requests").insert({order_id:input.orderId,requester_id:input.requesterId,pickup_address_id:input.pickupAddressId||null,dropoff_address_id:input.dropoffAddressId||null,notes:input.notes?.trim()||null}).select().single();
}
export async function assignDelivery(client:SupabaseClient,deliveryId:string,assigneeId:string){
  return client.rpc("assign_delivery",{p_delivery_id:deliveryId,p_assignee:assigneeId});
}
export async function listMyDeliveries(client:SupabaseClient){
  return client.from("delivery_requests").select("id,order_id,requester_id,pickup_address_id,dropoff_address_id,assigned_to,status,notes,requested_at,assigned_at,delivered_at").order("requested_at",{ascending:false});
}
export async function updateDeliveryStatus(client:SupabaseClient,deliveryId:string,status:string){
  return client.from("delivery_requests").update({status}).eq("id",deliveryId).select().single();
}