import type { SignUpProfileInput } from "@huambo-online/types";

export function normalizeProfileInput(input: SignUpProfileInput): SignUpProfileInput {
  return {
    ...input,
    fullName: input.fullName.trim(),
    phone: input.phone?.trim() || undefined,
    countryCode: input.countryCode.trim().toUpperCase()
  };
}