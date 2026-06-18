import { defineFunction } from "@aws-amplify/backend";

export const notifyPhotoApproval = defineFunction({
  name: "notify-photo-approval",
  resourceGroupName: "data",
  timeoutSeconds: 15,
});