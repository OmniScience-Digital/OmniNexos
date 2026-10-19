// amplify/function/notifyWorkAssigned/handler.ts
import { buildAssignmentMessages, type AssignmentArgs } from "./push";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

interface Event {
  arguments: AssignmentArgs;
}

/** Resolver of the notifyWorkAssigned mutation (see data/resource.ts). */
export const handler = async (event: Event) => {
  const messages = buildAssignmentMessages(event.arguments);
  if (messages.length === 0) return { success: false, reason: "Missing details or no valid Expo push tokens" };

  try {
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
    if (!response.ok) {
      const text = await response.text();
      console.error("Expo push send failed:", response.status, text);
      return { success: false, reason: `Expo answered ${response.status}` };
    }
    return { success: true, sent: messages.length };
  } catch (err) {
    console.error("Error sending work assigned notification:", err);
    return { success: false, reason: String(err) };
  }
};