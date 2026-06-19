const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

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

// Invoked directly as the resolver for the notifyPhotoRequestStatus custom
// mutation (see data/resource.ts) — the admin app calls this right when it
// approves/denies a PhotoChangeRequest. Takes the employee's push token(s)
// directly as an argument (looked up client-side by the admin app via the
// normal Data client, pushTokensByUser) — this function never touches
// DynamoDB or AppSync at all, it's a pure "send this push" operation.
// Still server-side, so it reaches the device even if the employee's app
// is fully closed.
interface NotifyEvent {
  arguments: {
    pushTokens: string[];
    status: string; // "APPROVED" | "DENIED"
  };
}

export const handler = async (event: NotifyEvent) => {
  const { pushTokens, status } = event.arguments ?? {};

  if (!pushTokens?.length || !status) {
    return { success: false, reason: "Missing pushTokens or status" };
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

  const validTokens = pushTokens.filter(
    (t): t is string => !!t && t.startsWith("ExponentPushToken")
  );

  if (validTokens.length === 0) {
    return { success: false, reason: "No valid Expo push tokens provided" };
  }

  try {
    await sendExpoPush(validTokens, title, body, {
      type: "PHOTO_CHANGE_REQUEST",
      status,
    });
    return { success: true };
  } catch (err) {
    console.error("Error sending photo approval notification:", err);
    return { success: false, reason: String(err) };
  }
};