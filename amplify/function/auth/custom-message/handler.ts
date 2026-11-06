// amplify/function/auth/custom-message/handler.ts 
//
// Cognito "Custom Message" trigger handler.
// Overrides ONLY the forgot-password email (CustomMessage_ForgotPassword).
// Every other trigger source (sign-up, resend code, admin invite) is returned untouched,
// so those emails keep the templates set in amplify/auth/resource.ts and amplify/backend.ts.
// Declared in: ./resource.ts
//
// RESET-TEMPLATE-TEST: subject and body deliberately mirror the admin-invite email
// (amplify/backend.ts inviteMessageTemplate), which is known to reach mass.kg and
// mass-oem.global. Same layout and subject style; only the credentials box differs.
// Once the delivery problem is solved, change the subject to something reset-specific.
import type { CustomMessageTriggerHandler } from "aws-lambda";

export const handler: CustomMessageTriggerHandler = async (event) => {
  // Proof that Cognito reached the "send an email" step. Never log the code.
  console.log("custom-message", event.triggerSource, event.userName);

  if (event.triggerSource === "CustomMessage_ForgotPassword") {
    // codeParameter is Cognito's literal "{####}" token. It substitutes the
    // real code AFTER this function returns, so it must appear in the message.
    const code = event.request.codeParameter;
    const year = new Date().getFullYear();

    event.response.emailSubject = "Welcome to Omni-Nexos";
    event.response.emailMessage = `
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
              We received a request to change the access details for your Omni-Nexos account.
              Use the code below in the app to continue.
            </p>

            <div class="credentials-box">
              <div class="label">Access Code</div>
              <div class="value">${code}</div>
            </div>

            <p class="note">
              This code expires in 1 hour. If you did not make this request,
              you can ignore this email and nothing will change.
            </p>
          </div>

          <div class="footer">
            © ${year} Omni-Nexos. All rights reserved.
          </div>

        </div>

      </body>
      </html>
    `;
  }

  return event;
};