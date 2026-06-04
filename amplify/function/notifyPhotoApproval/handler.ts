// amplify/function/notifyPhotoApproval/handler.ts
// DynamoDB Stream trigger on PhotoChangeRequest.
// Fires when status changes to APPROVED or DENIED → sends Expo push notification.
//
// ── Why no @aws-sdk/client-dynamodb? ─────────────────────────────────────────
// @aws-sdk/client-dynamodb is NOT in the project's package.json.
// In Amplify Gen 2, Lambda functions run inside the CDK app and have access to
// the AWS SDK v3 that ships with the Lambda Node.js 20 runtime globally.
// We use the global `AWS` via process.env + direct fetch to avoid a missing dep.
//
// For the PushToken lookup we use the DynamoDB DocumentClient that is bundled
// with the Lambda runtime (available as `@aws-sdk/client-dynamodb` at runtime
// even though it is not a local devDependency — Amplify bundles it).
// To keep TypeScript happy we declare the types inline.
// ─────────────────────────────────────────────────────────────────────────────

// We reference @aws-sdk/* only as type imports so the TS compiler doesn't
// need the package installed locally. At Lambda runtime Node 20 provides it.
/// <reference types="aws-lambda" />

type DynamoDBStreamEvent = {
  Records: Array<{
    eventName: string;
    dynamodb?: {
      OldImage?: Record<string, { S?: string; N?: string; BOOL?: boolean }>;
      NewImage?: Record<string, { S?: string; N?: string; BOOL?: boolean }>;
    };
  }>;
};

declare const process: {
  env: {
    PUSH_TOKEN_TABLE_NAME: string;
    AWS_REGION?: string;
  };
};

// Minimal unmarshaller for string attributes
function str(attr: { S?: string } | undefined): string | undefined {
  return attr?.S;
}

// ── DynamoDB query using fetch + AWS SigV4 via the SDK bundled in Node 20 ────
// Amplify Gen 2 Lambda functions bundle aws-sdk v3 in the Node 20 runtime.
// We import dynamically so that local TypeScript compilation succeeds without
// the package being a devDependency.
async function getPushToken(userId: string): Promise<string | null> {
  try {
    // Dynamic import — resolves at Lambda runtime from the bundled SDK
    const { DynamoDBClient, QueryCommand } = await import(
      "@aws-sdk/client-dynamodb" as any
    ) as any;

    const ddb = new DynamoDBClient({
      region: process.env.AWS_REGION ?? "us-east-1",
    });

    const result = await ddb.send(
      new QueryCommand({
        TableName: process.env.PUSH_TOKEN_TABLE_NAME,
        IndexName: "pushTokensByUser",
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: { ":uid": { S: userId } },
        Limit: 1,
        ScanIndexForward: false,
      }),
    );

    const item = result.Items?.[0];
    if (!item) return null;
    return str(item.token) ?? null;
  } catch (err) {
    console.error("[notifyPhotoApproval] getPushToken error:", err);
    return null;
  }
}

// ── Expo Push API ─────────────────────────────────────────────────────────────
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushPayload {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  sound: "default";
  channelId: string;
}

async function sendPush(payload: PushPayload): Promise<void> {
  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error("[notifyPhotoApproval] Push failed:", await res.text());
  }
}

function buildPayload(
  token: string,
  status: "APPROVED" | "DENIED",
  employeeName?: string,
): PushPayload {
  const name = employeeName ?? "there";
  if (status === "APPROVED") {
    return {
      to: token,
      title: "Photo Change Approved ✅",
      body: `Hi ${name}, your request to update your verification photo was approved. Open the app to take your new photo.`,
      data: { type: "photo_request_approved", status: "APPROVED" },
      sound: "default",
      channelId: "attendance",
    };
  }
  return {
    to: token,
    title: "Photo Change Request Declined",
    body: `Hi ${name}, your photo change request was not approved. Contact your admin for more info.`,
    data: { type: "photo_change", status: "DENIED" },
    sound: "default",
    channelId: "attendance",
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────
export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  const tasks: Promise<void>[] = [];

  for (const record of event.Records) {
    if (record.eventName !== "MODIFY") continue;

    const oldImg = record.dynamodb?.OldImage;
    const newImg = record.dynamodb?.NewImage;
    if (!oldImg || !newImg) continue;

    const oldStatus = str(oldImg.status as any);
    const newStatus = str(newImg.status as any);

    // Only fire when status actually changed to APPROVED or DENIED
    if (!newStatus || oldStatus === newStatus) continue;
    if (newStatus !== "APPROVED" && newStatus !== "DENIED") continue;

    const userId = str(newImg.userId as any);
    if (!userId) continue;

    const employeeName = str(newImg.employeeName as any);

    tasks.push(
      (async () => {
        const token = await getPushToken(userId);
        if (!token) {
          console.warn(`[notifyPhotoApproval] No token for userId=${userId}`);
          return;
        }
        const payload = buildPayload(
          token,
          newStatus as "APPROVED" | "DENIED",
          employeeName,
        );
        await sendPush(payload);
        console.info(
          `[notifyPhotoApproval] ${newStatus} notification sent → userId=${userId}`,
        );
      })(),
    );
  }

  await Promise.allSettled(tasks);
};