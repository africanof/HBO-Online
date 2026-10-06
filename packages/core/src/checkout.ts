import type { SupabaseClient } from "@supabase/supabase-js";

export async function checkoutCart(
  client: SupabaseClient,
  cartId: string,
  deliveryAddressId?: string,
  deliveryFee = 0
) {
  return client.rpc("checkout_cart", {
    p_cart_id: cartId,
    p_delivery_address_id: deliveryAddressId ?? null,
    p_delivery_fee: deliveryFee
  });
}