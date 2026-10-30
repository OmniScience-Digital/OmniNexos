// OmniNexos/amplify/function/auth/custom-message/resource.ts  (NEW - RESET-EMAIL)
//
// Declares the Cognito "Custom Message" trigger Lambda.
// Why: Cognito reuses the sign-up verification template for password resets, so reset
// emails said "complete your registration" and were being flagged as spam. This trigger
// lets the forgot-password email have its own subject and body.
// Wired in: OmniNexos/amplify/auth/resource.ts  (triggers.customMessage)
// Logic lives in: ./handler.ts
import { defineFunction } from "@aws-amplify/backend";

// Cognito "Custom Message" trigger. Lets us give the password-reset email its
// own subject/body instead of reusing the sign-up verification template.
// resourceGroupName "auth" keeps it in the auth stack (avoids a circular
// dependency between the auth and function stacks, same as post-confirmation).
export const customMessage = defineFunction({
  name: "custom-message",
  resourceGroupName: "auth",
});