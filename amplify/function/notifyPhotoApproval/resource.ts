import { defineFunction } from "@aws-amplify/backend";

// Called directly by the admin app (via the notifyPhotoRequestStatus custom
// mutation in data/resource.ts) right when it approves/denies a
// PhotoChangeRequest. Looks up the requesting user's stored Expo push
// token(s) by querying the AppSync GraphQL API (not directly touching
// DynamoDB) and sends a push notification via Expo's Push API.
export const notifyPhotoApproval = defineFunction({
  name: "notify-photo-approval",
  resourceGroupName: "data",
  timeoutSeconds: 15,
});