//amplify/function/auth/pre-signup/handler.ts
import { PreSignUpTriggerHandler } from "aws-lambda";
import {
    CognitoIdentityProviderClient,
    ListUsersCommand,
    AdminLinkProviderForUserCommand,
    type UserType,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({});

const attr = (u: UserType, n: string) => u.Attributes?.find((a) => a.Name === n)?.Value;
const isNative = (u: UserType) => !!u.Username && !u.Username.includes("_") && u.UserStatus !== "EXTERNAL_PROVIDER";

export const handler: PreSignUpTriggerHandler = async (event) => {
    try {
        // Cognito emails are case-sensitive in filters, so always compare lower-case.
        const rawEmail = event.request.userAttributes['email'];
        if (!rawEmail) throw new Error("Email is required for sign-up");
        const email = rawEmail.trim().toLowerCase();

        const emailParts = email.split('@');
        if (emailParts.length !== 2) throw new Error("Invalid email format");
        const domain = emailParts[1];

        const allowedDomains = ['omniscience', 'mass', 'sb-plant.com'];
        const isDomainAllowed = allowedDomains.some(d => domain.includes(d.toLowerCase()));
        const isAdminCreated = event.triggerSource === "PreSignUp_AdminCreateUser";

        if (!isDomainAllowed && !isAdminCreated) {
            throw new Error("Only company email addresses (@omniscience, @mass, or @sb-plant.com domains) are allowed for sign-up.");
        }

        if (isAdminCreated) {
            event.response.autoConfirmUser = true;
            event.response.autoVerifyEmail = true;
        }

        // ── Find every account already using this email (no Limit: 1, that hid the native one) ──
        const findByEmail = async () => {
            const res = await client.send(new ListUsersCommand({
                UserPoolId: event.userPoolId,
                Filter: `email = "${email}"`,
                Limit: 10,
            }));
            return res.Users ?? [];
        };

        // ── CASE 1: Google sign-in, native account already exists -> link Google onto the native one ──
        if (event.triggerSource === "PreSignUp_ExternalProvider") {
            // "Google_1234_5" -> provider "Google", id "1234_5" (split on the FIRST underscore only)
            const i = event.userName.indexOf("_");
            const providerName = event.userName.slice(0, i);
            const providerUserId = event.userName.slice(i + 1);

            const existing = await findByEmail();
            // Only link to a CONFIRMED native account with a verified email, otherwise someone could
            // pre-register your email and take over your Google login.
            const native = existing.find(
                (u) => isNative(u) && u.UserStatus === "CONFIRMED" && attr(u, "email_verified") === "true"
            );

            if (native) {
                await client.send(new AdminLinkProviderForUserCommand({
                    UserPoolId: event.userPoolId,
                    DestinationUser: { ProviderName: "Cognito", ProviderAttributeValue: native.Username },
                    SourceUser: {
                        ProviderName: providerName,
                        ProviderAttributeName: "Cognito_Subject",
                        ProviderAttributeValue: providerUserId,
                    },
                }));
            }
            event.response.autoConfirmUser = true;
            event.response.autoVerifyEmail = true;
        }

        // ── CASE 2: native sign-up, but this person already signed in with Google first ──
        // Cognito can only link a federated user that does NOT exist yet, so a native account cannot be
        // attached to an existing Google_ profile. Stop the duplicate and point them at Google instead.
        if (event.triggerSource === "PreSignUp_SignUp") {
            const existing = await findByEmail();
            const google = existing.find((u) => !isNative(u));
            if (google) {
                throw new Error("This email already has an account via Google. Please use 'Sign in with Google'.");
            }
        }

        return event;
    } catch (error) {
        console.error('Pre-sign-up error:', error);
        throw error;
    }
};