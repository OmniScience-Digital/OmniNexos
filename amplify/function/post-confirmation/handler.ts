//npm add --save-dev @aws-sdk/client-cognito-identity-provider

import { PostConfirmationTriggerHandler } from "aws-lambda";
import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } from "@aws-sdk/client-cognito-identity-provider";

export const handler: PostConfirmationTriggerHandler = async (event) => {

    const command = new AdminAddUserToGroupCommand({
        UserPoolId: event.userPoolId,
        Username: event.userName,
        GroupName: "USERS"
    });

    const client = new CognitoIdentityProviderClient({});

    try {
        const response = await client.send(command);

        return event;

    } catch (error) {

    }


}