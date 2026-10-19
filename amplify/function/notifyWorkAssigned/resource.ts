// amplify/function/notifyWorkAssigned/resource.ts
import { defineFunction } from "@aws-amplify/backend";

// Same pattern as notifyPhotoApproval: the web app looks up the technician's push token(s) with the normal Data client
// (pushTokensByUser) and passes them in, so this function only sends a push and never touches the data stack.
export const notifyWorkAssigned = defineFunction({
  name: "notify-work-assigned",
  resourceGroupName: "data",
  timeoutSeconds: 15,
});