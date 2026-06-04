// import { defineBackend } from '@aws-amplify/backend';
// import { auth } from './auth/resource.js';
// import { data } from './data/resource.js';
// import { storage } from './storage/resource.js';
// import { listUsers } from './function/listUsers/resource.js';
// import { verifyFace } from './function/verifyFace/resource.js';
// import * as iam from "aws-cdk-lib/aws-iam";
// import * as apigateway from "aws-cdk-lib/aws-apigateway";
// import { Stack } from "aws-cdk-lib";
// import { Function } from 'aws-cdk-lib/aws-lambda';

// const backend = defineBackend({
//   auth,
//   data,
//   storage,
//   listUsers,
//   verifyFace,
// });

// // ── listUsers permissions ────────────────────────────────────────────────────
// const listUsersLambda = backend.listUsers.resources.lambda;
// listUsersLambda.role?.attachInlinePolicy(
//   new iam.Policy(backend.auth.resources.userPool, "AllowListGroups", {
//     statements: [
//       new iam.PolicyStatement({
//         actions: [
//           "cognito-idp:ListUsers",
//           "cognito-idp:AdminListGroupsForUser",
//         ],
//         resources: [backend.auth.resources.userPool.userPoolArn],
//       }),
//     ],
//   })
// );

// // ── verifyFace — Rekognition + S3 permissions + REST API ─────────────────────
// const verifyFaceLambda = backend.verifyFace.resources.lambda as Function;
// const bucketName = backend.storage.resources.bucket.bucketName;

// verifyFaceLambda.addEnvironment("STORAGE_BUCKET_NAME", bucketName);

// verifyFaceLambda.role?.attachInlinePolicy(
//   new iam.Policy(verifyFaceLambda, "VerifyFacePolicy", {
//     statements: [
//       new iam.PolicyStatement({
//         actions: ["s3:GetObject"],
//         resources: [
//           `arn:aws:s3:::${bucketName}/hr/reference-faces/*`,
//           `arn:aws:s3:::${bucketName}/hr/clock-selfies/*`,
//         ],
//       }),
//       new iam.PolicyStatement({
//         actions: ["rekognition:CompareFaces"],
//         resources: ["*"],
//       }),
//     ],
//   })
// );

// // REST API — exposes verifyFace Lambda to the mobile app
// const stack = Stack.of(verifyFaceLambda);

// const api = new apigateway.LambdaRestApi(stack, "VerifyFaceApi", {
//   handler: verifyFaceLambda,
//   proxy: true,
//   defaultCorsPreflightOptions: {
//     allowOrigins: apigateway.Cors.ALL_ORIGINS,
//     allowMethods: apigateway.Cors.ALL_METHODS,
//   },
// });

// // Expose the endpoint URL so Amplify outputs picks it up
// backend.addOutput({
//   custom: {
//     verifyFaceApiUrl: api.url,
//   },
// });

import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { storage } from './storage/resource.js';
import { listUsers } from './function/listUsers/resource.js';
import { verifyFace } from './function/verifyFace/resource.js';
import { notifyPhotoApproval } from './function/notifyPhotoApproval/resource.js';
import * as iam from "aws-cdk-lib/aws-iam";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
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

// ── notifyPhotoApproval — DynamoDB stream trigger ────────────────────────────
const notifyLambda = backend.notifyPhotoApproval.resources.lambda as Function;

// Get the PhotoChangeRequest DynamoDB table from the data backend
const photoRequestTable = backend.data.resources.tables["PhotoChangeRequest"] as dynamodb.Table;
const pushTokenTable    = backend.data.resources.tables["PushToken"] as dynamodb.Table;

// Pass push token table name to Lambda env
notifyLambda.addEnvironment(
  "PUSH_TOKEN_TABLE_NAME",
  pushTokenTable.tableName,
);

// Grant Lambda read access to DynamoDB (stream + query PushToken)
pushTokenTable.grantReadData(notifyLambda);
photoRequestTable.grantStreamRead(notifyLambda);

// Attach DynamoDB Stream as event source
notifyLambda.addEventSource(
  new lambdaEventSources.DynamoEventSource(photoRequestTable, {
    startingPosition: lambda.StartingPosition.LATEST,
    batchSize: 10,
    bisectBatchOnError: true,
    retryAttempts: 2,
    filters: [
      // Only invoke when status field changes to APPROVED or DENIED
      lambda.FilterCriteria.filter({
        eventName: lambda.FilterRule.isEqual("MODIFY"),
        dynamodb: {
          NewImage: {
            status: {
              S: lambda.FilterRule.or("APPROVED", "DENIED"),
            },
          },
        },
      }),
    ],
  }),
);