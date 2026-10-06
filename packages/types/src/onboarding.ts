export interface SignUpProfileInput {
  fullName: string;
  phone?: string;
  countryCode: string;
}

export interface OnboardingState {
  profileCompleted: boolean;
  capabilities: string[];
  organizationsCount: number;
}