import {describe,expect,it} from "vitest";
import {getNotificationConversationId,getNotificationDestination,getNotificationListingId,getNotificationSavedSearchId} from "./notifications";

const uuid="550e8400-e29b-41d4-a716-446655440000";
const uuid2="6ba7b810-9dad-41d1-80b4-00c04fd430c8";

describe("notification destinations",()=>{
 it("accepts valid UUID destination ids",()=>{
  const n={data:{conversation_id:uuid,listing_id:uuid2,saved_search_id:"invalid"}};
  expect(getNotificationConversationId(n)).toBe(uuid);
  expect(getNotificationListingId(n)).toBe(uuid2);
  expect(getNotificationSavedSearchId(n)).toBeNull();
 });
 it("prioritizes conversation, then listing, then saved search",()=>{
  expect(getNotificationDestination({data:{conversation_id:uuid,listing_id:uuid2}})).toEqual({kind:"conversation",id:uuid});
  expect(getNotificationDestination({data:{listing_id:uuid2}})).toEqual({kind:"listing",id:uuid2});
  expect(getNotificationDestination({data:{saved_search_id:uuid}})).toEqual({kind:"saved_search",id:uuid});
 });
 it("returns null for malformed or missing data",()=>{
  expect(getNotificationDestination({data:{listing_id:"123"}})).toBeNull();
  expect(getNotificationDestination({data:{}})).toBeNull();
 });
});
