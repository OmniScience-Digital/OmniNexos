import {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminAddUserToGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({});

interface InviteUserEvent {
    arguments: {
        email: string;
        name: string; // preferred_username, e.g. "John Cross"
    };
}

export const handler = async (event: InviteUserEvent) => {
    const { email, name } = event.arguments ?? {};
    const userPoolId = process.env.AMPLIFY_AUTH_USERPOOL_ID;

    if (!email || !name) {
        return { success: false, reason: "Missing email or name" };
    }

    try {
        // Creates the user and emails them a temporary password via
        // Cognito's default invitation message. They're forced to set a
        // new password on first login (Cognito's default behavior for
        // AdminCreateUser — FORCE_CHANGE_PASSWORD status).
        await client.send(new AdminCreateUserCommand({
            UserPoolId: userPoolId,
            Username: email,
            UserAttributes: [
                { Name: "email", Value: email },
                { Name: "email_verified", Value: "true" },
                { Name: "preferred_username", Value: name },
            ],
            DesiredDeliveryMediums: ["EMAIL"],
        }));

        await client.send(new AdminAddUserToGroupCommand({
            UserPoolId: userPoolId,
            Username: email,
            GroupName: "USERS",
        }));

        return { success: true };
    } catch (error) {
        console.error('inviteUser error:', error);
        return { success: false, reason: String(error) };
    }
};