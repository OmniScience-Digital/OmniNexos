import {
    CognitoIdentityProviderClient,
    AdminEnableUserCommand,
    AdminDisableUserCommand,
    AdminDeleteUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({});

type ManageAction = "ENABLE" | "DISABLE" | "DELETE";

interface ManageUserEvent {
    arguments: {
        username: string;
        action: ManageAction;
    };
}

export const handler = async (event: ManageUserEvent) => {
    const { username, action } = event.arguments ?? {};
    const userPoolId = process.env.AMPLIFY_AUTH_USERPOOL_ID;

    if (!username || !action) {
        return { success: false, reason: "Missing username or action" };
    }

    try {
        switch (action) {
            case "ENABLE":
                await client.send(new AdminEnableUserCommand({
                    UserPoolId: userPoolId,
                    Username: username,
                }));
                break;

            case "DISABLE":
                await client.send(new AdminDisableUserCommand({
                    UserPoolId: userPoolId,
                    Username: username,
                }));
                break;

            case "DELETE":
                await client.send(new AdminDeleteUserCommand({
                    UserPoolId: userPoolId,
                    Username: username,
                }));
                break;

            default:
                return { success: false, reason: `Unknown action "${action}"` };
        }

        return { success: true };
    } catch (error) {
        console.error(`manageUser (${action}) error:`, error);
        return { success: false, reason: String(error) };
    }
};