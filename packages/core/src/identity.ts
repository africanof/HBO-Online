import type { AccountCapability } from "@huambo-online/types";

export const ACCOUNT_CAPABILITIES: readonly AccountCapability[] = [
  "customer",
  "provider",
  "seller",
  "business_owner",
  "business_staff",
  "courier"
] as const;

export function canUseCapability(
  capabilities: readonly AccountCapability[],
  capability: AccountCapability
): boolean {
  return capabilities.includes(capability);
}