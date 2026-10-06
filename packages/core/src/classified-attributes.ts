export interface VehicleAttributes {
 brand:string; model?:string; year?:number; mileage?:number; fuel?:string;
 transmission?:string; bodyType?:string; color?:string; condition?:string;
}
export interface RealEstateAttributes {
 propertyType?:string; areaM2?:number; bedrooms?:number; bathrooms?:number;
 parkingSpaces?:number; furnished?:boolean; condition?:string;
}
export type ClassifiedAttributes=VehicleAttributes|RealEstateAttributes|Record<string,unknown>;