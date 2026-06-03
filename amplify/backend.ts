import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { storage } from './storage/resource.js';
import { listUsers } from './function/listUsers/resource.js';
import { verifyFace } from './function/verifyFace/resource.js';
import * as iam from "aws-cdk-lib/aws-iam";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Stack } from "aws-cdk-lib";
import { Function } from 'aws-cdk-lib/aws-lambda';

const backend = defineBackend({
  auth,
  data,
  storage,
  listUsers,
  verifyFace,
});

// ── listUsers permissions ────────────────────────────────────────────────────
const listUsersLambda = backend.listUsers.resources.lambda;
listUsersLambda.role?.attachInlinePolicy(
  new iam.Policy(backend.auth.resources.userPool, "AllowListGroups", {
    statements: [
      new iam.PolicyStatement({
        actions: [
          "cognito-idp:ListUsers",
          "cognito-idp:AdminListGroupsForUser",
        ],
        resources: [backend.auth.resources.userPool.userPoolArn],
      }),
    ],
  })
);

// ── verifyFace — Rekognition + S3 permissions + REST API ─────────────────────
const verifyFaceLambda = backend.verifyFace.resources.lambda as Function;
const bucketName = backend.storage.resources.bucket.bucketName;

verifyFaceLambda.addEnvironment("STORAGE_BUCKET_NAME", bucketName);

verifyFaceLambda.role?.attachInlinePolicy(
  new iam.Policy(verifyFaceLambda, "VerifyFacePolicy", {
    statements: [
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [
          `arn:aws:s3:::${bucketName}/hr/reference-faces/*`,
          `arn:aws:s3:::${bucketName}/hr/clock-selfies/*`,
        ],
      }),
      new iam.PolicyStatement({
        actions: ["rekognition:CompareFaces"],
        resources: ["*"],
      }),
    ],
  })
);

// REST API — exposes verifyFace Lambda to the mobile app
const stack = Stack.of(verifyFaceLambda);

const api = new apigateway.LambdaRestApi(stack, "VerifyFaceApi", {
  handler: verifyFaceLambda,
  proxy: true,
  defaultCorsPreflightOptions: {
    allowOrigins: apigateway.Cors.ALL_ORIGINS,
    allowMethods: apigateway.Cors.ALL_METHODS,
  },
});

// Expose the endpoint URL so Amplify outputs picks it up
backend.addOutput({
  custom: {
    verifyFaceApiUrl: api.url,
  },
});