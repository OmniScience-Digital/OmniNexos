// amplify/function/admin/list-users-with-groups/handler.ts  (MODIFIED - now reads EVERY page of groups and of users in each group)
import {
  CognitoIdentityProviderClient,
  ListGroupsCommand,
  ListUsersInGroupCommand,
  type UserType,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({});

interface CognitoLike {
  send: (command: any) => Promise<any>;
}

export interface GroupWithUsers {
  groupName: string | undefined;
  users: { username: string | undefined; email: string; status: string | undefined }[];
}

/** Every group, each with every user in it. Cognito returns at most 60 per call, so keep following the token. */
export async function listAllGroupsWithUsers(cognito: CognitoLike, userPoolId: string): Promise<GroupWithUsers[]> {
  // 1. Get ALL groups
  const groups: { GroupName?: string }[] = [];
  let groupToken: string | undefined;
  do {
    const res = await cognito.send(new ListGroupsCommand({ UserPoolId: userPoolId, NextToken: groupToken }));
    groups.push(...(res.Groups ?? []));
    groupToken = res.NextToken;
  } while (groupToken);

  // 2. For each group, get ALL its users
  const result: GroupWithUsers[] = [];
  for (const group of groups) {
    const users: UserType[] = [];
    let userToken: string | undefined;
    do {
      const res = await cognito.send(
        new ListUsersInGroupCommand({ UserPoolId: userPoolId, GroupName: group.GroupName!, NextToken: userToken })
      );
      users.push(...(res.Users ?? []));
      userToken = res.NextToken;
    } while (userToken);

    result.push({
      groupName: group.GroupName,
      users: users.map((user) => ({
        username: user.Username,
        email: user.Attributes?.find((a) => a.Name === "email")?.Value || "",
        status: user.UserStatus,
      })),
    });
  }
  return result;
}

export const handler = async () => {
  try {
    const userPoolId = process.env.USER_POOL_ID!;
    const result = await listAllGroupsWithUsers(client, userPoolId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        userPoolId,
        groups: result,
      }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to fetch groups and users",
      }),
    };
  }
};