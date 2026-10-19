// amplify/function/notifyWorkAssigned/push.ts
// Builds the push notification for "work assigned to you". Pure: no network.

export interface AssignmentArgs {
  pushTokens: string[];
  workItemId: string;
  jobCardId: string;
  jcNumber: string;
  scaleName: string;
  workItemLabel: string;
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: { type: "jobcard-assigned"; workItemId: string; jobCardId: string };
  sound: "default";
  priority: "high";
  channelId: "jobcards";
}

/** Expo push tokens look like ExponentPushToken[...] (older) or ExpoPushToken[...] (newer). */
export const isExpoToken = (t: unknown): t is string =>
  typeof t === "string" && /^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(t);

/** One message per distinct valid token. Returns [] when there is nothing valid to send to. */
export function buildAssignmentMessages(a: Partial<AssignmentArgs> | null | undefined): ExpoMessage[] {
  if (!a || !a.workItemId || !a.jobCardId || !a.jcNumber || !a.scaleName || !a.workItemLabel) return [];
  const tokens = [...new Set((a.pushTokens ?? []).filter(isExpoToken))];
  return tokens.map((to) => ({
    to,
    title: "New job card work",
    body: `${a.workItemLabel} - ${a.scaleName} (${a.jcNumber})`,
    data: { type: "jobcard-assigned", workItemId: a.workItemId!, jobCardId: a.jobCardId! },
    sound: "default",
    priority: "high",
    channelId: "jobcards",
  }));
}