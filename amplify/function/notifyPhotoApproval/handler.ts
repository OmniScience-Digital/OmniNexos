// Declare `process` to avoid TypeScript error (it exists at runtime)
declare const process: {
  env: {
    APPSYNC_ENDPOINT: string;
    APPSYNC_API_KEY: string;
  };
};

const APPSYNC_ENDPOINT = process.env.APPSYNC_ENDPOINT!;
const APPSYNC_API_KEY = process.env.APPSYNC_API_KEY!;

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

interface NotifyEvent {
  arguments: {
    userId: string;
    status: string;
  };
}

// GraphQL query – uses the existing pushTokensByUser index.
const GET_PUSH_TOKENS = /* GraphQL */ `
  query GetPushTokens($userId: String!) {
    pushTokensByUser(userId: $userId) {
      items {
        token
      }
    }
  }
`;

async function getPushTokensForUser(userId: string): Promise<string[]> {
  const response = await fetch(APPSYNC_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": APPSYNC_API_KEY,
    },
    body: JSON.stringify({
      query: GET_PUSH_TOKENS,
      variables: { userId },
    }),
  });

  if (!response.ok) {
    throw new Error(`AppSync request failed: ${response.status}`);
  }

  const json = await response.json();
  if (json.errors) {
    throw new Error(json.errors[0].message);
  }

  const items = json.data?.pushTokensByUser?.items ?? [];
  return items
    .map((item: any) => item.token)
    .filter((token: string) => token && token.startsWith("ExponentPushToken"));
}

async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<void> {
  if (tokens.length === 0) return;

  const messages = tokens.map((to) => ({
    to,
    title,
    body,
    data,
    sound: "default",
    priority: "high",
    channelId: "attendance",
  }));

  const response = await fetch(EXPO_PUSH_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Expo push send failed:", response.status, text);
  } else {
    const json = await response.json();
    console.log("Expo push send response:", JSON.stringify(json));
  }
}

export const handler = async (event: NotifyEvent) => {
  const { userId, status } = event.arguments ?? {};

  if (!userId || !status) {
    return { success: false, reason: "Missing userId or status" };
  }

  let title: string | null = null;
  let body: string | null = null;

  if (status === "APPROVED") {
    title = "Photo approved";
    body = "Your reference photo has been approved. You're all set to clock in.";
  } else if (status === "DENIED") {
    title = "Photo needs changes";
    body = "Your reference photo was not approved. Please submit a new one.";
  } else {
    return { success: false, reason: `Status "${status}" is not notification-worthy` };
  }

  try {
    const tokens = await getPushTokensForUser(userId);

    if (tokens.length === 0) {
      console.log(`No valid push tokens for user ${userId}`);
      return { success: false, reason: "No registered push tokens for this user" };
    }

    await sendExpoPush(tokens, title, body, {
      type: "PHOTO_CHANGE_REQUEST",
      status,
      userId,
    });

    return { success: true };
  } catch (err) {
    console.error("Error sending photo approval notification:", err);
    return { success: false, reason: String(err) };
  }
};