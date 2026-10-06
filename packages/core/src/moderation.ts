import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportTarget, UserRole } from "@huambo-online/types";

export async function reportContent(client:SupabaseClient,input:{reporterId:string;targetType:ReportTarget;targetId:string;reason:string;details?:string}){
  return client.from("moderation_reports").insert({reporter_id:input.reporterId,target_type:input.targetType,target_id:input.targetId,reason:input.reason.trim(),details:input.details?.trim()||null}).select().single();
}
export async function listMyReports(client:SupabaseClient){
  return client.from("moderation_reports").select("id,reporter_id,target_type,target_id,reason,details,status,resolved_by,resolved_at,created_at").order("created_at",{ascending:false});
}
export async function isModerator(client:SupabaseClient){
  const {data}=await client.rpc("has_admin_role");
  return Boolean(data);
}
export async function getMyRole(client:SupabaseClient,userId:string): Promise<{data:{role:UserRole}|null;error:any}> {
  const result = await client.from("user_roles").select("role").eq("user_id",userId).maybeSingle();
  return {data: result.data as {role:UserRole}|null, error: result.error};
}