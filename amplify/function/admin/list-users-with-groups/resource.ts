// function/admin/list-users-with-groups/resource.ts
import { defineFunction } from "@aws-amplify/backend";

export const listUsersWithGroups = defineFunction({
  name: "listUsersWithGroups",
  entry: "./handler.ts",
  environment: {
    USER_POOL_ID: "${resources.auth.resources.userPoolId}"
  }
});