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

        if (!isDomainAllowed) {
            // Self-signup stays company-only. Non-company users (contractors,
            // clients) are onboarded by an admin via inviteUser instead —
            // AdminCreateUser bypasses this trigger's normal signup path.
            throw new Error("Only company email addresses (@omniscience, @mass, or @sb-plant.com domains) are allowed for sign-up.");
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