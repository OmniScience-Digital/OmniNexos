// import { defineBackend } from '@aws-amplify/backend';
// import { auth } from './auth/resource.js';
// import { data } from './data/resource.js';
// import { storage } from './storage/resource.js';
// import { listUsers } from './function/listUsers/resource.js';
// import { verifyFace } from './function/verifyFace/resource.js';
// import { notifyPhotoApproval } from './function/notifyPhotoApproval/resource.js';
// import { manageUser } from './function/manageUser/resource.js';
// import { inviteUser } from './function/inviteUser/resource.js';
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
//   notifyPhotoApproval,
//   manageUser,
//   inviteUser,
// });

// const { cfnUserPool } = backend.auth.resources.cfnResources;

// cfnUserPool.emailConfiguration = {
//   emailSendingAccount: "DEVELOPER",
//   sourceArn: "arn:aws:ses:us-east-1:346858644516:identity/omninexos.fray.co.za",
//   from: "Omni-Nexos <noreply@omninexos.fray.co.za>",
// };

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

// const stack = Stack.of(verifyFaceLambda);

// const api = new apigateway.LambdaRestApi(stack, "VerifyFaceApi", {
//   handler: verifyFaceLambda,
//   proxy: true,
//   defaultCorsPreflightOptions: {
//     allowOrigins: apigateway.Cors.ALL_ORIGINS,
//     allowMethods: apigateway.Cors.ALL_METHODS,
//   },
// });

// backend.addOutput({
//   custom: {
//     verifyFaceApiUrl: api.url,
//   },
// });

// // manageUser and inviteUser need no manual IAM here — their permissions
// // come declaratively from the `access` array in auth/resource.ts.


import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { storage } from './storage/resource.js';
import { listUsers } from './function/listUsers/resource.js';
import { verifyFace } from './function/verifyFace/resource.js';
import { notifyPhotoApproval } from './function/notifyPhotoApproval/resource.js';
import { manageUser } from './function/manageUser/resource.js';
import { inviteUser } from './function/inviteUser/resource.js';
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
  manageUser,
  inviteUser,
});

const { cfnUserPool } = backend.auth.resources.cfnResources;

cfnUserPool.emailConfiguration = {
  emailSendingAccount: "DEVELOPER",
  sourceArn: "arn:aws:ses:us-east-1:346858644516:identity/omninexos.fray.co.za",
  from: "Omni-Nexos <noreply@omninexos.fray.co.za>",
};

// Styled to match the sign-up verification email (auth/resource.ts). Not
// exposed by defineAuth at all — same situation as the SES sender ARN
// above — so it's set the same way, directly on the L1 resource.
// `{username}` and `{####}` are Cognito's literal placeholder tokens; it
// substitutes them at send time, and CloudFormation requires `{####}` to be
// present or deployment fails validation.
// `allowAdminCreateUserOnly: false` is repeated here (not just
// `inviteMessageTemplate`) because this is a full replace of
// `adminCreateUserConfig`, and leaving it out would silently reset self-service
// sign-up to admin-only.
cfnUserPool.adminCreateUserConfig = {
  allowAdminCreateUserOnly: false,
  inviteMessageTemplate: {
    emailSubject: "Welcome to Omni-Nexos",
    emailMessage: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
      <meta charset="UTF-8" />
      <title>Welcome</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: #f4f6f8;
          font-family: 'Segoe UI', Arial, sans-serif;
        }

        .container {
          max-width: 600px;
          margin: 40px auto;
          background: #ffffff;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 4px 18px rgba(0,0,0,0.08);
        }

        .header {
          background: #1f3c88;
          color: #ffffff;
          padding: 24px;
          text-align: center;
          font-size: 22px;
          font-weight: 600;
          letter-spacing: 0.5px;
        }

        .content {
          padding: 32px;
          color: #333;
          text-align: center;
        }

        .content p {
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 24px;
        }

        .credentials-box {
          display: inline-block;
          background: #f1f4f9;
          padding: 16px 32px;
          border-radius: 8px;
          font-size: 16px;
          color: #1f3c88;
          margin-bottom: 24px;
          text-align: left;
        }

        .credentials-box .label {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: #6b7794;
          margin-bottom: 4px;
        }

        .credentials-box .value {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: 1px;
          margin-bottom: 16px;
          word-break: break-all;
        }

        .note {
          font-size: 14px;
          color: #666;
        }

        .footer {
          background: #f9fafb;
          padding: 18px;
          text-align: center;
          font-size: 13px;
          color: #888;
        }
      </style>
      </head>

      <body>

        <div class="container">

          <div class="header">
            Welcome to Omni-Nexos
          </div>

          <div class="content">
            <p>
              An administrator has created an account for you on Omni-Nexos.
              Use the temporary credentials below to sign in for the first time.
            </p>

            <div class="credentials-box">
              <div class="label">Username</div>
              <div class="value">{username}</div>
              <div class="label">Temporary Password</div>
              <div class="value">{####}</div>
            </div>

            <p class="note">
              You will be asked to set a new password the first time you sign in.
            </p>
          </div>

          <div class="footer">
            © ${new Date().getFullYear()} Omni-Nexos. All rights reserved.
          </div>

        </div>

      </body>
      </html>
    `,
  },
};

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

const stack = Stack.of(verifyFaceLambda);

const api = new apigateway.LambdaRestApi(stack, "VerifyFaceApi", {
  handler: verifyFaceLambda,
  proxy: true,
  defaultCorsPreflightOptions: {
    allowOrigins: apigateway.Cors.ALL_ORIGINS,
    allowMethods: apigateway.Cors.ALL_METHODS,
  },
});

backend.addOutput({
  custom: {
    verifyFaceApiUrl: api.url,
  },
});

