// amplify/auth/resource.ts
//
// Cognito auth definition: email login, Google sign-in, verification email, SES sender,
// triggers and group/permission access.
// Additions: 2 for JOBCARD (listTechnicians import + access), and 2 for RESET-EMAIL:
//   - import of customMessage  (next to the postConfirmation import)
//   - triggers.customMessage   (inside `triggers`), which gives password-reset emails
//     their own template via amplify/function/auth/custom-message/
import { defineAuth, secret } from "@aws-amplify/backend";
import { preSignup } from "../function/auth/pre-signup/resource";
import { postConfirmation } from "../function/post-confirmation/resource";
import { customMessage } from "../function/auth/custom-message/resource"; // RESET-EMAIL
import { listUsers } from "../function/listUsers/resource";
import { manageUser } from "../function/manageUser/resource";
import { inviteUser } from "../function/inviteUser/resource";
import { listTechnicians } from "../function/listTechnicians/resource"; // JOBCARD

export const auth = defineAuth({
  loginWith: {
    email: {
      verificationEmailStyle: "CODE",
      // VERIFY-TEMPLATE-TEST: subject/body deliberately mirror the admin-invite email
      // (amplify/backend.ts inviteMessageTemplate), which is known to reach mass.kg and
      // mass-oem.global. Same layout, same subject style; only the credentials box differs.
      verificationEmailSubject: "Welcome to Omni-Nexos",
      verificationEmailBody: (createCode) => `
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
            <img
              src="https://omninexos.fray.co.za/assets/logo-2.png"
              alt="Omni-Nexos"
              width="48"
              height="48"
              style="display:block; margin:0 auto 12px; border:0; height:auto;"
            />
            Welcome to Omni-Nexos
          </div>

          <div class="content">
            <p>
              Thank you for joining Omni-Nexos.
              Use the code below in the app to finish creating your account.
            </p>

            <div class="credentials-box">
              <div class="label">Sign-up Code</div>
              <div class="value">${createCode()}</div>
            </div>

            <p class="note">
              You will be asked to enter this code the first time you sign in.
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

    externalProviders: {
      google: {
        clientId: secret("GOOGLE_CLIENT_ID"),
        clientSecret: secret("GOOGLE_CLIENT_SECRET"),

        scopes: ["profile", "email"],
        attributeMapping: {
          email: "email",
          emailVerified: "email_verified", // GOOGLE-VERIFIED-FIX: copy Google's verified flag onto the Cognito user
          preferredUsername: "name",
        },
      },
      callbackUrls: [
        "http://localhost:5173/landing",
        "https://vite.d2ib10qin54ac6.amplifyapp.com/landing",
        "https://test.d2ib10qin54ac6.amplifyapp.com/landing",
        "https://main.d2ib10qin54ac6.amplifyapp.com/landing",
        "reactnativeomninexos://",
        "https://omninexos.fray.co.za/landing",
        "https://test.omninexos.fray.co.za/landing",
        "https://test.d2ib10qin54ac6.amplifyapp.com/landing",
      ],
      logoutUrls: [
        "http://localhost:5173/",
        "https://vite.d2ib10qin54ac6.amplifyapp.com/",
        "https://test.d2ib10qin54ac6.amplifyapp.com/",
        "https://main.d2ib10qin54ac6.amplifyapp.com/",
        "reactnativeomninexos://",
        "https://omninexos.fray.co.za/",
        "https://test.omninexos.fray.co.za/",
        "https://test.d2ib10qin54ac6.amplifyapp.com/",
      ],
    },
  },
  userAttributes: {
    preferredUsername: {
      mutable: true,
      required: true,
    },
  },

  senders: {
    email: {
      fromEmail: "noreply@omninexos.fray.co.za",
      fromName: "Omni-Nexos",
    },
  },
  triggers: {
    preSignUp: preSignup,
    postConfirmation: postConfirmation,
    customMessage: customMessage, // RESET-EMAIL: own template for forgot-password
  },
  access: (allow) => [
    allow.resource(postConfirmation).to(["addUserToGroup"]),
    allow.resource(listUsers).to(["listUsers"]),
    allow.resource(manageUser).to(["enableUser", "disableUser", "deleteUser"]),
    allow.resource(inviteUser).to(["createUser", "addUserToGroup"]),
    allow.resource(listTechnicians).to(["listUsers"]),
  ],
  groups: ["ADMINS", "USERS"],
});