import { defineFunction } from "@aws-amplify/backend";

// Called by the admin app to onboard a non-company person (contractor,
// client) directly — no self-signup form involved. resourceGroupName
// "auth" for the AMPLIFY_AUTH_USERPOOL_ID env var, same pattern as
// listUsers and manageUser.
export const inviteUser = defineFunction({
  name: "invite-user",
  resourceGroupName: "auth",
  timeoutSeconds: 15,
});