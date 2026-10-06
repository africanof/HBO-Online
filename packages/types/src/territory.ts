export interface Commune { id: string; municipalityId: string; name: string; active: boolean; }
export interface Street { id: string; neighborhoodId: string; name: string; active: boolean; }
export interface Address { id: string; streetId?: string; houseNumber?: string; addressLabel: string; latitude?: number; longitude?: number; plusCode?: string; referencePoint?: string; active: boolean; }