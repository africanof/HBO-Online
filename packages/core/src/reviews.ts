import type { SupabaseClient } from "@supabase/supabase-js";

export async function createReview(client: SupabaseClient, input: {
  authorId: string; businessId?: string; providerId?: string; productId?: string; serviceId?: string;
  orderId?: string; rating: 1|2|3|4|5; title?: string; comment?: string;
}) {
  return client.from("reviews").insert({
    author_id: input.authorId, business_id: input.businessId ?? null, provider_id: input.providerId ?? null,
    product_id: input.productId ?? null, service_id: input.serviceId ?? null, order_id: input.orderId ?? null,
    rating: input.rating, title: input.title?.trim() || null, comment: input.comment?.trim() || null
  }).select().single();
}

export async function listPublishedReviews(client: SupabaseClient, target: {businessId?:string;providerId?:string;productId?:string;serviceId?:string}) {
  let q=client.from("reviews").select("id,author_id,business_id,provider_id,product_id,service_id,order_id,rating,title,comment,status,created_at").eq("status","published");
  if(target.businessId) q=q.eq("business_id",target.businessId);
  if(target.providerId) q=q.eq("provider_id",target.providerId);
  if(target.productId) q=q.eq("product_id",target.productId);
  if(target.serviceId) q=q.eq("service_id",target.serviceId);
  return q.order("created_at",{ascending:false});
}

export async function getRatingSummary(client: SupabaseClient, targetId: string, field: "business_id"|"provider_id"|"product_id"|"service_id") {
  return client.from("rating_summaries").select("average_rating,review_count").eq(field,targetId).maybeSingle();
}