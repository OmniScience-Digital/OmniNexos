import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { storage } from './storage/resource.js';
import { listUsers } from './function/listUsers/resource.js';
import { verifyFace } from './function/verifyFace/resource.js';
import { notifyPhotoApproval } from './function/notifyPhotoApproval/resource.js';
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
  notifyPhotoApproval,
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

// ── notifyPhotoApproval — called directly when admin approves/denies ────────
// Instead of watching the PhotoChangeRequest table for changes via a
// DynamoDB Stream, the admin app calls this directly as a custom GraphQL
// mutation (see data/resource.ts: notifyPhotoRequestStatus) right when it
// approves/denies a request. The mutation takes the employee's push
// token(s) directly as an argument — the admin app looks those up via the
// normal Data client (pushTokensByUser) BEFORE calling this mutation, so
// this Lambda never touches DynamoDB or AppSync at all. No environment
// variables, no IAM grants, no circular dependency: it's just a plain
// function-backed resolver, same pattern as `usersList` / listUsers.