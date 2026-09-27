import { defineFunction } from "@aws-amplify/backend";

// Called directly by the admin app (via the manageUserAccount custom
// mutation in data/resource.ts) to approve, reject, re-enable, or delete a
// user's Cognito account. resourceGroupName "auth" so it gets
// AMPLIFY_AUTH_USERPOOL_ID injected automatically — same pattern as
// listUsers, which is also referenced from the data schema despite living
// in the auth resource group.
export const manageUser = defineFunction({
  name: "manage-user",
  resourceGroupName: "auth",
  timeoutSeconds: 15,
});