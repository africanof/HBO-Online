import type { ListingType } from "@huambo-online/types";

export * from "./discovery";
export * from "./identity";
export * from "./profile";
export * from "./onboarding";
export * from "./location";
export * from "./listings";
export * from "./marketplace";
export * from "./checkout";
export * from "./commerce";
export * from "./reviews";
export { unsaveItem, followBusiness, unfollowBusiness, followProvider, unfollowProvider } from "./favorites";
export * from "./messaging";
export * from "./auctions";
export * from "./auction-lifecycle";
export * from "./delivery";
export * from "./notifications";
export * from "./notification-preferences";
export * from "./moderation";
export * from "./search";
export * from "./provinces";
export * from "./categories";
export { getReputation } from "./reputation";
export { removeSavedItem, saveItem as saveSavedItem, listSavedItems as listSavedItemsV2, isClassifiedListingSaved, saveClassifiedListing, removeClassifiedListing } from "./saved-items";
export * from "./classified-listings";
export * from "./classified-auctions";
export * from "./classified-messaging";
export * from "./rentals";
export * from "./classified-moderation";
export * from "./classified-workflow";
export * from "./classified-attributes";
export * from "./classified-search";
export * from "./classified-location-search";
export * from "./classified-saved-searches";

export const PLATFORM_NAME = "Huambo Online";

export function getListingLabel(type: ListingType): string {
  switch (type) {
    case "product": return "Produto";
    case "service": return "Serviço";
    case "classified": return "Classificado";
  }
}
export { changeCurrentUserPassword, requestPasswordReset, deleteCurrentUserAccount } from "./account-security";
