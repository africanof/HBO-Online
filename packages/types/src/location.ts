export interface Province { id: string; name: string; countryCode: string; }
export interface Municipality { id: string; provinceId: string; name: string; }
export interface Neighborhood { id: string; municipalityId: string; name: string; }