// src/utils/helper/ticket.ts
// TICKETING: pure helpers for the Task Form. No React, no Amplify, so they are easy to test.
import { DateTime } from "luxon";
import {
  ASSIGNEE_OPTIONS,
  URGENCY_OPTIONS,
  type TicketFormValues,
  type TicketSubmitter,
} from "@/types/ticket.types";

export const TITLE_MAX = 120;
export const OUTCOME_MAX = 2000;

export type TicketFormErrors = Partial<Record<keyof TicketFormValues, string>>;

export const emptyTicketForm = (): TicketFormValues => ({
  title: "",
  requiredOutcome: "",
  urgency: "",
  assignees: [],
  mit: false,
});

/** Returns an object of field -> message. Empty object means the form is valid. */
export function validateTicketForm(v: TicketFormValues): TicketFormErrors {
  const errors: TicketFormErrors = {};

  const title = v.title.trim();
  if (!title) errors.title = "Enter a task title.";
  else if (title.length > TITLE_MAX) errors.title = `Keep the title under ${TITLE_MAX} characters.`;

  const outcome = v.requiredOutcome.trim();
  if (!outcome) errors.requiredOutcome = "Describe the outcome you need.";
  else if (outcome.length > OUTCOME_MAX) {
    errors.requiredOutcome = `Keep the outcome under ${OUTCOME_MAX} characters.`;
  }

  if (!v.urgency) errors.urgency = "Choose how urgent this is.";
  else if (!URGENCY_OPTIONS.some((o) => o.value === v.urgency)) errors.urgency = "Choose one of the listed urgencies.";

  if (v.assignees.length === 0) errors.assignees = "Select at least one person.";
  else if (v.assignees.some((n) => !(ASSIGNEE_OPTIONS as readonly string[]).includes(n))) {
    errors.assignees = "One of the selected people is not on the list.";
  }

  return errors;
}

/**
 * What gets saved. Only user-typed fields plus status SUBMITTED: the task number,
 * due date and ClickUp details are filled in by the backend, never by the browser.
 */
export function buildTicketInput(v: TicketFormValues, who: TicketSubmitter, now: Date = new Date()) {
  return {
    title: v.title.trim(),
    requiredOutcome: v.requiredOutcome.trim(),
    urgency: v.urgency as string,
    assignees: [...new Set(v.assignees)],
    mit: v.mit,
    status: "SUBMITTED" as const,
    createdBy: who.id,
    createdByName: who.name || undefined,
    createdByEmail: who.email || undefined,
    submittedAt: now.toISOString(), // ordering only; the backend uses the server's createdAt for due dates
  };
}

/** "Tue 10 Nov, 13:00" in Johannesburg time, or a dash when there is no date yet. */
export function formatDue(iso: string | null | undefined): string {
  if (!iso) return "-";
  const dt = DateTime.fromISO(iso, { setZone: true }).setZone("Africa/Johannesburg");
  return dt.isValid ? dt.toFormat("ccc d LLL, HH:mm") : "-";
}