export type SavedEntityType = "business"|"provider"|"service"|"product";

export interface SavedItem {
  id:string;
  userId:string;
  type:SavedEntityType;
  entityId:string;
  createdAt:string;
}

export interface FollowedBusiness { userId:string; businessId:string; createdAt:string; }
export interface FollowedProvider { userId:string; providerId:string; createdAt:string; }