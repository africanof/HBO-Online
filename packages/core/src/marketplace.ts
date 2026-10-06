import type { SupabaseClient } from "@supabase/supabase-js";

export async function getOrCreateCart(client: SupabaseClient, userId: string) {
  const existing=await client.from("carts").select("id,user_id,created_at,updated_at").eq("user_id",userId).maybeSingle();
  if(existing.data||existing.error) return existing;
  return client.from("carts").insert({user_id:userId}).select("id,user_id,created_at,updated_at").single();
}

export async function addToCart(client: SupabaseClient, cartId:string, productId:string, quantity:number) {
  return client.from("cart_items").upsert({cart_id:cartId,product_id:productId,quantity},{onConflict:"cart_id,product_id"}).select().single();
}

export async function updateCartItem(client: SupabaseClient, itemId:string, quantity:number) {
  if(quantity<=0) return client.from("cart_items").delete().eq("id",itemId);
  return client.from("cart_items").update({quantity}).eq("id",itemId);
}

export async function getCart(client: SupabaseClient, cartId:string) {
  return client.from("cart_items").select("id,cart_id,product_id,quantity,products(id,name,price,currency,stock,seller_id)").eq("cart_id",cartId);
}

export async function listMyOrders(client: SupabaseClient) {
  return client.from("orders").select("id,status,currency,subtotal,delivery_fee,total,delivery_address_id,created_at,updated_at").order("created_at",{ascending:false});
}