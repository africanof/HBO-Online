import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassifiedListingType, ClassifiedPurpose } from "@huambo-online/types";

export async function createClassifiedListing(client:SupabaseClient,input:{
  ownerId:string; categoryId?:string; addressId?:string; listingType:ClassifiedListingType;
  purpose:ClassifiedPurpose; title:string; description?:string; price?:number;
  attributes?:Record<string,unknown>; media?:string[];
}){
  return client.from("classified_listings").insert({
    owner_id:input.ownerId,category_id:input.categoryId||null,address_id:input.addressId||null,
    listing_type:input.listingType,purpose:input.purpose,title:input.title.trim(),
    description:input.description?.trim()||null,price:input.price??null,
    attributes:input.attributes||{},media:input.media||[]
  }).select().single();
}

export async function listClassifiedListings(client:SupabaseClient,filters:{
  listingType?:ClassifiedListingType; purpose?:ClassifiedPurpose; categoryId?:string;
}={}){
  let q=client.from("classified_listings").select("id,owner_id,category_id,address_id,listing_type,purpose,title,description,price,currency,attributes,media,status,featured,created_at,updated_at").eq("status","published").order("created_at",{ascending:false});
  if(filters.listingType) q=q.eq("listing_type",filters.listingType);
  if(filters.purpose) q=q.eq("purpose",filters.purpose);
  if(filters.categoryId) q=q.eq("category_id",filters.categoryId);
  return q;
}

export async function listClassifiedListingsByIds(client:SupabaseClient,ids:string[]){
 const clean=[...new Set(ids.filter(id=>typeof id==="string"&&id.length>0))];
 if(!clean.length)return {data:[],error:null};
 return client.from("classified_listings").select("id,owner_id,category_id,address_id,listing_type,purpose,title,description,price,currency,attributes,media,status,featured,created_at,updated_at").in("id",clean).eq("status","published").order("created_at",{ascending:false});
}

export async function getClassifiedListing(client:SupabaseClient,id:string){
  return client.from("classified_listings").select("id,owner_id,category_id,address_id,listing_type,purpose,title,description,price,currency,attributes,media,status,featured,created_at,updated_at").eq("id",id).eq("status","published").maybeSingle();
}

export async function updateClassifiedStatus(client:SupabaseClient,id:string,status:string){
  return client.from("classified_listings").update({status,updated_at:new Date().toISOString()}).eq("id",id).select().single();
}
export async function uploadClassifiedMedia(client:SupabaseClient,file:Blob,ownerId:string,filename?:string,contentType?:string){
  const ext=((filename||"image.jpg").split(".").pop()||"jpg").toLowerCase();
  const path=ownerId+"/"+crypto.randomUUID()+"."+ext;
  const uploaded=await client.storage.from("classified-media").upload(path,file,{upsert:false,contentType:contentType||file.type||"image/jpeg"});
  if(uploaded.error) return uploaded;
  const url=client.storage.from("classified-media").getPublicUrl(path).data.publicUrl;
  return {data:url,error:null};
}
