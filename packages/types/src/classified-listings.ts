export type ClassifiedListingType="real_estate"|"vehicle"|"product"|"service"|"classified";
export type ClassifiedPurpose="sale"|"rent"|"lease"|"auction"|"wanted"|"service";
export type ClassifiedStatus="draft"|"published"|"paused"|"sold"|"rented"|"closed"|"cancelled";
export interface ClassifiedListing {
  id:string; ownerId:string; categoryId?:string; addressId?:string;
  listingType:ClassifiedListingType; purpose:ClassifiedPurpose; title:string; description?:string;
  price?:number; currency:"AOA"; attributes:Record<string,unknown>; media:string[];
  status:ClassifiedStatus; featured:boolean; createdAt:string; updatedAt:string;
}