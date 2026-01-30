import { 
  ListUsersCommand, 
  AdminListGroupsForUserCommand,
  CognitoIdentityProviderClient 
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient()

export const handler = async () => {
  const userPoolId = process.env.AMPLIFY_AUTH_USERPOOL_ID;
  
  console.log('UserPoolId:', userPoolId);
  
  // 1. Get all users
  const listCommand = new ListUsersCommand({ 
    UserPoolId: userPoolId,
    Limit: 60
  });
  
  const response = await client.send(listCommand);
  console.log('Total users found:', response.Users?.length);
  
  // 2. For each user, get their groups
  const usersWithGroups = await Promise.all(
    response.Users?.map(async (user) => {
      try {
        console.log(`Getting groups for user: ${user.Username}`);
        
        const groupsCommand = new AdminListGroupsForUserCommand({
          UserPoolId: userPoolId,
          Username: user.Username
        });
        
        const groupsResponse = await client.send(groupsCommand);
        console.log(`Groups for ${user.Username}:`, groupsResponse.Groups?.map(g => g.GroupName));
        
        return {
          Username: user.Username,
          Attributes: user.Attributes,
          UserCreateDate: user.UserCreateDate?.toISOString(),
          UserLastModifiedDate: user.UserLastModifiedDate?.toISOString(),
          Enabled: user.Enabled,
          UserStatus: user.UserStatus,
          Groups: groupsResponse.Groups?.map(g => g.GroupName) || []
        };
      } catch (error) {
        console.error(`Error getting groups for ${user.Username}:`, error);
        return {
          Username: user.Username,
          Attributes: user.Attributes,
          UserCreateDate: user.UserCreateDate?.toISOString(),
          UserLastModifiedDate: user.UserLastModifiedDate?.toISOString(),
          Enabled: user.Enabled,
          UserStatus: user.UserStatus,
          Groups: []
        };
      }
    }) || []
  );
  
  console.log('Final users with groups:', usersWithGroups);
  return usersWithGroups;
}

