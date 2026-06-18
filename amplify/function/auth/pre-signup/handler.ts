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

        // Check if email exists
        if (!email) {
            throw new Error("Email is required for sign-up");
        }

        // Extract and normalize domain
        const emailParts = email.split('@');
        if (emailParts.length !== 2) {
            throw new Error("Invalid email format");
        }

        const domain = emailParts[1].toLowerCase();

        // Define allowed domains
        const allowedDomains = [
            'omniscience',
            'mass',
            'sb-plant.com'
        ];

        // Check if domain matches any allowed domain
        const isDomainAllowed = allowedDomains.some(allowedDomain =>
            domain.includes(allowedDomain.toLowerCase())
        );

        if (!isDomainAllowed) {
            // Reject sign-up with a user-friendly error
            throw new Error("Only company email addresses (@omniscience, @mass, or @sb-plant.com domains) are allowed for sign-up.");
        }

        // ── Account linking for federated (Google, etc.) sign-ins ───────────
        // When someone signs in via an external IdP for the first time,
        // Cognito invokes this trigger with triggerSource
        // "PreSignUp_ExternalProvider" *before* creating a brand-new,
        // separate user pool entry for them. If a native (email/password)
        // user already exists with this email, we link the federated
        // identity to that existing user instead of letting a duplicate
        // account get created — so "the same person" ends up as ONE
        // Cognito user (one `sub`) regardless of how they sign in, and our
        // app data (e.g. the face-verification reference photo keyed by
        // userId) stays attached to a single identity.
        if (event.triggerSource === "PreSignUp_ExternalProvider") {
            const userPoolId = event.userPoolId;

            // event.userName for an external provider sign-up looks like
            // "Google_<google-user-id>" — split out provider + raw subject.
            const [providerName, providerUserId] = event.userName.split("_");

            const existing = await client.send(
                new ListUsersCommand({
                    UserPoolId: userPoolId,
                    Filter: `email = "${email}"`,
                    Limit: 1,
                })
            );

            const existingUser = existing.Users?.[0];

            // Only link against a NATIVE Cognito user (one that signed up
            // with email/password) — never link two different federated
            // providers together here, and never link to another federated
            // user, to avoid accidentally chaining unrelated identities.
            const isExistingNativeUser =
                existingUser &&
                existingUser.Username &&
                !existingUser.Username.includes("_"); // federated usernames contain "_"

            if (isExistingNativeUser) {
                await client.send(
                    new AdminLinkProviderForUserCommand({
                        UserPoolId: userPoolId,
                        DestinationUser: {
                            ProviderName: "Cognito",
                            ProviderAttributeValue: existingUser!.Username,
                        },
                        SourceUser: {
                            ProviderName: providerName, // e.g. "Google"
                            ProviderAttributeName: "Cognito_Subject",
                            ProviderAttributeValue: providerUserId,
                        },
                    })
                );
            }

            // Federated users are pre-verified by the IdP — auto-confirm so
            // they aren't asked to verify an email they already verified
            // with Google.
            event.response.autoConfirmUser = true;
            if (email) event.response.autoVerifyEmail = true;
        }

        return event;
    } catch (error) {
        console.error('Pre-sign-up error:', error);
        // Re-throw the error to prevent sign-up
        throw error;
    }
};