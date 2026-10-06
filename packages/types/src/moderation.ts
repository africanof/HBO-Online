export type UserRole="user"|"moderator"|"admin";
export type ReportTarget="business"|"provider"|"service"|"product"|"auction"|"review"|"user"|"message";
export type ReportStatus="open"|"reviewing"|"resolved"|"dismissed";
export interface ModerationReport { id:string; reporterId:string; targetType:ReportTarget; targetId:string; reason:string; details?:string; status:ReportStatus; resolvedBy?:string; resolvedAt?:string; createdAt:string; }