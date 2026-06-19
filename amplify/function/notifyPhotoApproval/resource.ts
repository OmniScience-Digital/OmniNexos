import { defineFunction } from "@aws-amplify/backend";

// Called directly by the admin app (via the notifyPhotoRequestStatus custom
// mutation in data/resource.ts) right when it approves/denies a
// PhotoChangeRequest. Takes the employee's push token(s) directly as a
// mutation argument — the admin app looks those up via the normal
// Amplify Data client (pushTokensByUser) BEFORE calling this function, so
// this Lambda never touches DynamoDB, AppSync, or `data` at all. That
// means it has zero dependency on the data stack, so registering it
// normally in defineBackend alongside `data` creates no circular
// dependency (unlike a version that reads backend.data.resources... for
// env vars while also being referenced as a data resolver).
export const notifyPhotoApproval = defineFunction({
  name: "notify-photo-approval",
  resourceGroupName: "data",
  timeoutSeconds: 15,
});