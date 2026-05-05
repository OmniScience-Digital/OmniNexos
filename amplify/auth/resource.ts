import { defineAuth, secret } from "@aws-amplify/backend";
import { preSignup } from "../function/auth/pre-signup/resource";
import { postConfirmation } from "../function/post-confirmation/resource";
import { listUsers } from "../function/listUsers/resource";

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: {
      verificationEmailStyle: 'CODE',
      verificationEmailSubject: 'Omni-Nexos | Verify Your Email',
      verificationEmailBody: (createCode) => `
        <!DOCTYPE html>
        <html lang="en">
        <head>
        <meta charset="UTF-8" />
        <title>Verify Email</title>
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

          .code-box {
            display: inline-block;
            background: #f1f4f9;
            padding: 16px 32px;
            border-radius: 8px;
            font-size: 26px;
            font-weight: 700;
            letter-spacing: 4px;
            color: #1f3c88;
            margin-bottom: 24px;
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
                Thank you for joining Omni-Nexos.  
                To complete your registration, please verify your email using the code below:
              </p>

              <div class="code-box">
                ${createCode()}
              </div>

              <p class="note">
                This code will expire shortly. If you didn’t request this, please ignore this email.
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
          preferredUsername: "name"
        },

      },
      callbackUrls: [
        "http://localhost:5173/landing","https://vite.d2ib10qin54ac6.amplifyapp.com/landing","https://test.d2ib10qin54ac6.amplifyapp.com/landing","https://main.d2ib10qin54ac6.amplifyapp.com/landing","reactnativeomninexos://"

      ],
      logoutUrls: [
        "http://localhost:5173/","https://vite.d2ib10qin54ac6.amplifyapp.com/","https://test.d2ib10qin54ac6.amplifyapp.com/","https://main.d2ib10qin54ac6.amplifyapp.com/","reactnativeomninexos://"

      ],
    },
  }, userAttributes: {
    preferredUsername: {
      mutable: true,
      required: true
    }
  },
  triggers: {
    preSignUp: preSignup,
    postConfirmation: postConfirmation
  },
  access: (allow) => [allow.resource(postConfirmation).to(['addUserToGroup']), allow.resource(listUsers).to(["listUsers"]),],
  groups: ['ADMINS', 'USERS']
});


