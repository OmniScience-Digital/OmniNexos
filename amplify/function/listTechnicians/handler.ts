// amplify/function/listTechnicians/handler.ts  (NEW FILE)
// Read-only list of system login users for the "assign to technician" picker.
// Unlike usersList (admins only, returns groups and account status), this returns only id, name and email of
// enabled users, so any signed-in office user can read it.
import { CognitoIdentityProviderClient, ListUsersCommand, type UserType } from "@aws-sdk/client-cognito-identity-provider";
import { toTechnicians } from "./technicians";

const client = new CognitoIdentityProviderClient();

export const handler = async () => {
  const userPoolId = process.env.AMPLIFY_AUTH_USERPOOL_ID;
  // Amplify only injects this for functions listed in the access rules of amplify/auth/resource.ts.
  if (!userPoolId) throw new Error("AMPLIFY_AUTH_USERPOOL_ID is not set: add listTechnicians to the access rules in amplify/auth/resource.ts");
  const users: UserType[] = [];
  let token: string | undefined;
  do {
    // Cognito returns at most 60 users per call, so follow the pagination token to get everyone.
    const res = await client.send(new ListUsersCommand({ UserPoolId: userPoolId, PaginationToken: token }));
    users.push(...(res.Users ?? []));
    token = res.PaginationToken;
  } while (token);
  return toTechnicians(users);
};