// OmniNexos/amplify/function/auth/custom-message/handler.ts 
//
// Cognito "Custom Message" trigger handler.
// Overrides ONLY the forgot-password email (CustomMessage_ForgotPassword): new subject
// and body that say "Reset your password" instead of "complete your registration".
// Every other trigger source (sign-up, resend code, admin invite) is returned untouched,
// so those emails keep the templates set in amplify/auth/resource.ts and amplify/backend.ts.
// Declared in: ./resource.ts
import type { CustomMessageTriggerHandler } from "aws-lambda";

/**
 * Only the forgot-password email is overridden. Every other trigger source
 * (sign-up, resend code, admin invite, ...) is returned untouched, so Cognito
 * keeps using the templates already configured in auth/resource.ts and
 * backend.ts.
 */
export const handler: CustomMessageTriggerHandler = async (event) => {
  if (event.triggerSource === "CustomMessage_ForgotPassword") {
    // codeParameter is Cognito's literal "{####}" token. It substitutes the
    // real code AFTER this function returns, so it must appear in the message.
    const code = event.request.codeParameter;
    const year = new Date().getFullYear();

    event.response.emailSubject = "Omni-Nexos | Reset your password";
    event.response.emailMessage = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.08);">

    <div style="background:#1f3c88;color:#ffffff;padding:24px;text-align:center;font-size:22px;font-weight:600;">
      Omni-Nexos
    </div>

    <div style="padding:32px;color:#333333;text-align:center;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#1f3c88;">Reset your password</h2>
      <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">
        We received a request to reset the password for your Omni-Nexos account.
        Enter the code below in the app to choose a new password.
      </p>

      <div style="display:inline-block;background:#f1f4f9;padding:16px 32px;border-radius:8px;font-size:26px;font-weight:700;letter-spacing:4px;color:#1f3c88;margin-bottom:24px;">
        ${code}
      </div>

      <p style="font-size:14px;line-height:1.6;color:#666666;margin:0;">
        This code expires in 1 hour. If you did not request a password reset,
        you can safely ignore this email &mdash; your password will not change.
      </p>
    </div>

    <div style="background:#f9fafb;padding:18px;text-align:center;font-size:13px;color:#888888;">
      &copy; ${year} Omni-Nexos. All rights reserved.
    </div>

  </div>
</body>
</html>`;
  }

  return event;
};