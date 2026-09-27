import { PreSignUpTriggerHandler } from "aws-lambda";
import {
    CognitoIdentityProviderClient,
    ListUsersCommand,
    AdminLinkProviderForUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({});

export const handler: PreSignUpTriggerHandler = async (event) => {
    try {
        const email = event.request.userAttributes['email'];

        if (!email) {
            throw new Error("Email is required for sign-up");
        }

        const emailParts = email.split('@');
        if (emailParts.length !== 2) {
            throw new Error("Invalid email format");
        }

        const domain = emailParts[1].toLowerCase();

        const allowedDomains = [
            'omniscience',
            'mass',
            'sb-plant.com'
        ];

        const isDomainAllowed = allowedDomains.some(allowedDomain =>
            domain.includes(allowedDomain.toLowerCase())
        );

        // Admin-created users (via inviteUser/AdminCreateUser) bypass the
        // domain restriction — that's the whole point of the invite flow.
        // Only self-signup (native email/password) enforces company-only.
        const isAdminCreated = event.triggerSource === "PreSignUp_AdminCreateUser";

        if (!isDomainAllowed && !isAdminCreated) {
            throw new Error("Only company email addresses (@omniscience, @mass, or @sb-plant.com domains) are allowed for sign-up.");
        }

        // Admin-created accounts: the admin already vouched for this email
        // (typed it in themselves) so there's no OTP step to complete —
        // auto-confirm and auto-verify so the account is immediately usable
        // once the invited person signs in with their temporary password.
        // Cognito still forces a password change on first login
        // (FORCE_CHANGE_PASSWORD status) independently of this flag — that
        // part is handled on the frontend via the NEW_PASSWORD_REQUIRED
        // sign-in challenge, not here.
        if (isAdminCreated) {
            event.response.autoConfirmUser = true;
            event.response.autoVerifyEmail = true;
        }

        // ── Account linking for federated (Google, etc.) sign-ins ───────────
        if (event.triggerSource === "PreSignUp_ExternalProvider") {
            const userPoolId = event.userPoolId;
            const [providerName, providerUserId] = event.userName.split("_");

            const existing = await client.send(
                new ListUsersCommand({
                    UserPoolId: userPoolId,
                    Filter: `email = "${email}"`,
                    Limit: 1,
                })
            );

            const existingUser = existing.Users?.[0];
            const isExistingNativeUser =
                existingUser &&
                existingUser.Username &&
                !existingUser.Username.includes("_");

            if (isExistingNativeUser) {
                await client.send(
                    new AdminLinkProviderForUserCommand({
                        UserPoolId: userPoolId,
                        DestinationUser: {
                            ProviderName: "Cognito",
                            ProviderAttributeValue: existingUser!.Username,
                        },
                        SourceUser: {
                            ProviderName: providerName,
                            ProviderAttributeName: "Cognito_Subject",
                            ProviderAttributeValue: providerUserId,
                        },
                    })
                );
            }

            event.response.autoConfirmUser = true;
            if (email) event.response.autoVerifyEmail = true;
        }

        return event;
    } catch (error) {
        console.error('Pre-sign-up error:', error);
        throw error;
    }
};