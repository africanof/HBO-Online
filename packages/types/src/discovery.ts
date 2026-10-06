export type DiscoveryEntityType = "business" | "provider" | "service" | "product";

export interface DiscoveryQuery {
  text?: string;
  entityType?: DiscoveryEntityType;
  categoryId?: string;
  municipalityId?: string;
  neighborhoodId?: string;
  verifiedOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
}

export interface DiscoveryResult {
  id: string;
  type: DiscoveryEntityType;
  title: string;
  subtitle?: string;
  category?: string;
  verified?: boolean;
  rating?: number;
  reviewCount?: number;
  price?: number;
  currency?: "AOA";
  municipalityId?: string;
  neighborhoodId?: string;
  distanceKm?: number;
}