// amplify/function/notifyPhotoApproval/resource.ts
import { defineFunction } from "@aws-amplify/backend";

export const notifyPhotoApproval = defineFunction({
  name: "notify-photo-approval",
  // Needs DynamoDB Streams read access + DDB query for PushToken table
  // Permissions are granted in amplify/backend.ts (see note below)
});