// amplify/function/notifyWorkAssigned/push.ts
// Builds the push notification for "job card assigned to you". One notification per job card. Pure: no network.

export interface AssignmentArgs {
  pushTokens: string[];
  jobCardId: string;
  jcNumber: string;
  customerName?: string | null;
  /** Ignored. Older callers may still send these; a job card is assigned as a whole, so no alert names a work item. */
  workItemId?: string | null;
  scaleName?: string | null;
  workItemLabel?: string | null;
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: { type: "jobcard-assigned"; jobCardId: string };
  sound: "default";
  priority: "high";
  channelId: "jobcards";
}

/** Expo push tokens look like ExponentPushToken[...] (older) or ExpoPushToken[...] (newer). */
export const isExpoToken = (t: unknown): t is string =>
  typeof t === "string" && /^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(t);

/** The alert text: "New Jc : <job card number>", with the customer on the second line. */
export const assignmentTitle = (jcNumber: string) => `New Jc : ${jcNumber}`;

/** One message per distinct valid token. Returns [] when there is nothing valid to send to. */
export function buildAssignmentMessages(a: Partial<AssignmentArgs> | null | undefined): ExpoMessage[] {
  if (!a || !a.jobCardId || !a.jcNumber) return [];
  const tokens = [...new Set((a.pushTokens ?? []).filter(isExpoToken))];
  const customer = a.customerName?.trim();
  return tokens.map((to) => ({
    to,
    title: assignmentTitle(a.jcNumber!),
    body: customer || "Assigned to you",
    data: { type: "jobcard-assigned", jobCardId: a.jobCardId! },
    sound: "default",
    priority: "high",
    channelId: "jobcards",
  }));
}