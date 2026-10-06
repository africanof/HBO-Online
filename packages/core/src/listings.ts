import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateBusinessInput, CreateProductInput, CreateServiceInput } from "@huambo-online/types";

export async function createBusiness(client: SupabaseClient, userId: string, input: CreateBusinessInput) {
  return client.from("businesses").insert({owner_id:userId,name:input.name.trim(),description:input.description?.trim(),category_id:input.categoryId||null,organization_id:input.organizationId||null,address_id:input.addressId||null}).select().single();
}
export async function createService(client: SupabaseClient, userId: string, input: CreateServiceInput) {
  return client.from("services").insert({provider_id:userId,title:input.title.trim(),description:input.description?.trim(),category_id:input.categoryId||null,business_id:input.businessId||null,price_from:input.priceFrom??null,address_id:input.addressId||null}).select().single();
}
export async function createProduct(client: SupabaseClient, userId: string, input: CreateProductInput) {
  return client.from("products").insert({seller_id:userId,name:input.name.trim(),description:input.description?.trim(),category_id:input.categoryId||null,business_id:input.businessId||null,price:input.price,stock:input.stock,address_id:input.addressId||null}).select().single();
}
export async function createProviderProfile(client: SupabaseClient, userId: string, input: {displayName:string;headline?:string;bio?:string;categoryId?:string;addressId?:string;phone?:string}) {
  return client.from("provider_profiles").upsert({user_id:userId,display_name:input.displayName.trim(),headline:input.headline?.trim(),bio:input.bio?.trim(),category_id:input.categoryId||null,address_id:input.addressId||null,phone:input.phone||null},{onConflict:"user_id"}).select().single();
}