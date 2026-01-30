import {
  CognitoIdentityProviderClient,
  ListGroupsCommand,
  ListUsersInGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({});

export const handler = async () => {
  try {
    const userPoolId = process.env.USER_POOL_ID!;
    const result = [];
    
    // 1. Get all groups
    const groupsResponse = await client.send(
      new ListGroupsCommand({
        UserPoolId: userPoolId,
      })
    );
    
    // 2. For each group, get users
    for (const group of groupsResponse.Groups || []) {
      const usersResponse = await client.send(
        new ListUsersInGroupCommand({
          UserPoolId: userPoolId,
          GroupName: group.GroupName!,
        })
      );
      
      result.push({
        groupName: group.GroupName,
        users: usersResponse.Users?.map(user => ({
          username: user.Username,
          email: user.Attributes?.find(a => a.Name === 'email')?.Value || '',
          status: user.UserStatus,
        })) || [],
      });
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        userPoolId,
        groups: result,
      }),
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch groups and users',
      }),
    };
  }
};