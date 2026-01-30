import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { storage } from './storage/resource.js';
import * as iam from "aws-cdk-lib/aws-iam";
import { listUsers } from './function/listUsers/resource.js';

const backend = defineBackend({
  auth,
  data,
  storage,
  listUsers  
});

// Grant listUsers function permission to read groups
const lambdaFunction = backend.listUsers.resources.lambda;
lambdaFunction.role?.attachInlinePolicy(
  new iam.Policy(backend.auth.resources.userPool, "AllowListGroups", {
    statements: [
      new iam.PolicyStatement({
        actions: [
          "cognito-idp:ListUsers",
          "cognito-idp:AdminListGroupsForUser"
        ],
        resources: [backend.auth.resources.userPool.userPoolArn],
      }),
    ],
  })
);