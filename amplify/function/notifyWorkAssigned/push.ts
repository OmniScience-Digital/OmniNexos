// amplify/function/notifyWorkAssigned/push.ts
// Builds the push notification for "job card assigned to you". Pure: no network.

export interface AssignmentArgs {
  pushTokens: string[];
  jobCardId: string;
  jcNumber: string;
  customerName?: string | null;
  /** Legacy: set only by a caller that still assigns a single work item. */
  workItemId?: string | null;
  scaleName?: string | null;
  workItemLabel?: string | null;
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: { type: "jobcard-assigned"; jobCardId: string; workItemId?: string };
  sound: "default";
  priority: "high";
  channelId: "jobcards";
}

/** Expo push tokens look like ExponentPushToken[...] (older) or ExpoPushToken[...] (newer). */
export const isExpoToken = (t: unknown): t is string =>
  typeof t === "string" && /^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(t);

/** One message per distinct valid token. Returns [] when there is nothing valid to send to. */
export function buildAssignmentMessages(a: Partial<AssignmentArgs> | null | undefined): ExpoMessage[] {
  if (!a || !a.jobCardId || !a.jcNumber) return [];
  const tokens = [...new Set((a.pushTokens ?? []).filter(isExpoToken))];

  // Legacy single work item message, kept for callers that still send one.
  const legacy = Boolean(a.workItemId && a.scaleName && a.workItemLabel);
  const title = legacy ? "New job card work" : "Job card assigned to you";
  const body = legacy
    ? `${a.workItemLabel} - ${a.scaleName} (${a.jcNumber})`
    : a.customerName ? `${a.jcNumber} - ${a.customerName}` : a.jcNumber;

  return tokens.map((to) => ({
    to,
    title,
    body,
    data: { type: "jobcard-assigned", jobCardId: a.jobCardId!, ...(legacy ? { workItemId: a.workItemId! } : {}) },
    sound: "default",
    priority: "high",
    channelId: "jobcards",
  }));
}