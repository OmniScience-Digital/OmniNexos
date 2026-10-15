// amplify/function/listUsers/handler.ts  (MODIFIED - now reads EVERY page of users, not just the first 60)
import {
  ListUsersCommand,
  AdminListGroupsForUserCommand,
  CognitoIdentityProviderClient,
  type UserType,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient();

/** Cognito rate-limits per-user calls, so groups are looked up a few users at a time, not all at once. */
const GROUP_LOOKUP_CONCURRENCY = 10;

interface CognitoLike {
  send: (command: any) => Promise<any>;
}

export interface UserWithGroups {
  Username?: string;
  Attributes?: UserType["Attributes"];
  UserCreateDate?: string;
  UserLastModifiedDate?: string;
  Enabled?: boolean;
  UserStatus?: string;
  Groups: string[];
}

/** Every user in the pool, each with their groups. Same output shape as before. */
export async function listAllUsers(cognito: CognitoLike, userPoolId: string | undefined): Promise<UserWithGroups[]> {
  if (!userPoolId) throw new Error("AMPLIFY_AUTH_USERPOOL_ID is not set");

  // 1. Get ALL users. Cognito returns at most 60 per call; keep following the pagination token.
  const users: UserType[] = [];
  let token: string | undefined;
  do {
    const res = await cognito.send(new ListUsersCommand({ UserPoolId: userPoolId, PaginationToken: token }));
    users.push(...(res.Users ?? []));
    token = res.PaginationToken;
  } while (token);

  // 2. For each user, get their groups (a failed lookup gives an empty group list, as before)
  const describe = async (user: UserType): Promise<UserWithGroups> => {
    let groups: string[] = [];
    try {
      const res = await cognito.send(new AdminListGroupsForUserCommand({ UserPoolId: userPoolId, Username: user.Username }));
      groups = (res.Groups ?? []).map((g: { GroupName?: string }) => g.GroupName).filter((n: string | undefined): n is string => Boolean(n));
    } catch (error) {
      console.error(`Error getting groups for ${user.Username}:`, error);
    }
    return {
      Username: user.Username,
      Attributes: user.Attributes,
      UserCreateDate: user.UserCreateDate?.toISOString(),
      UserLastModifiedDate: user.UserLastModifiedDate?.toISOString(),
      Enabled: user.Enabled,
      UserStatus: user.UserStatus,
      Groups: groups,
    };
  };

  const result: UserWithGroups[] = [];
  for (let i = 0; i < users.length; i += GROUP_LOOKUP_CONCURRENCY) {
    result.push(...(await Promise.all(users.slice(i, i + GROUP_LOOKUP_CONCURRENCY).map(describe))));
  }
  return result;
}

export const handler = async () => listAllUsers(client, process.env.AMPLIFY_AUTH_USERPOOL_ID);