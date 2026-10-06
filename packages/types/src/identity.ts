export type AccountCapability = "customer" | "provider" | "seller" | "business_owner" | "business_staff" | "courier";

export interface UserProfile {
  id: string;
  displayName: string;
  phone?: string;
  avatarUrl?: string;
  countryCode: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  type: "business" | "store" | "organization";
  verified: boolean;
}

export interface ProviderSummary {
  id: string;
  displayName: string;
  categories: string[];
  verified: boolean;
}