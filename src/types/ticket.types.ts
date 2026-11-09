// src/types/ticket.types.ts
// TICKETING: shared types and the fixed option lists for the Task Form.
// The lists below come from the "Tasking System" spreadsheet. The backend validates
// the urgency value again (helper/ticket/ticket.config.ts) so the two lists must match.

export type TicketStatus = "SUBMITTED" | "OPEN" | "CLOSED" | "FAILED";

export const URGENCY_OPTIONS = [
  { value: "ASAP", label: "ASAP" },
  { value: "1H", label: "1 hour" },
  { value: "2H", label: "2 hours" },
  { value: "4H", label: "4 hours" },
  { value: "16H", label: "16 hours" },
  { value: "27H", label: "27 hours" },
] as const;

export type UrgencyValue = (typeof URGENCY_OPTIONS)[number]["value"];

// Names that can be ticked on the form. The backend matches each one to a ClickUp
// user; any name that is not on ClickUp is given to Gleed instead.
export const ASSIGNEE_OPTIONS = [
  "Shaughn",
  "Marco",
  "Byron",
  "Conraad",
  "Willie",
  "Martiens",
  "Maryke",
  "Wendie",
  "Vehan",
  "Gert",
  "Tshepo",
] as const;

/** What the form collects. */
export interface TicketFormValues {
  title: string;
  requiredOutcome: string;
  urgency: UrgencyValue | "";
  assignees: string[];
  mit: boolean;
}

/** Who is submitting (taken from the signed-in user, never typed). */
export interface TicketSubmitter {
  id: string;
  name?: string;
  email?: string;
}

/** A ticket as the "My tickets" list shows it. */
export interface TicketSummary {
  id: string;
  ticketNumber: string | null;
  title: string;
  urgency: string;
  assignees: string[];
  status: TicketStatus;
  dueAt: string | null;
  clickupTaskUrl: string | null;
  lastError: string | null;
  createdAt: string;
}