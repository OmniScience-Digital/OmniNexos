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

/** Business minutes each urgency allows (ASAP = 0). Must match the backend's ticket.config.ts. */
export const URGENCY_MINUTES: Record<UrgencyValue, number> = {
  ASAP: 0,
  "1H": 60,
  "2H": 120,
  "4H": 240,
  "16H": 960,
  "27H": 1620,
};

// The standard list from the spreadsheet. Everyone here always appears in the people picker.
// When the same person exists in ClickUp the picker shows them once, with a "ClickUp user" tag;
// anyone not on ClickUp stays selectable and is given to the fallback user
// (TICKET_ESCALATION_USER_ID) by the backend.
// Gleed is NOT listed on purpose: he is a ClickUp user (shown as "G"), so he comes from ClickUp.
// Listing him here as well made him appear twice.
export const SHEET_PEOPLE = [
  "Shaughn",
  "Marco",
  "Byron",
  "Conraad",
  "Willie",
  "Martiens",
  "Nkulu",
  "Maryke",
  "Wendie",
  "Vehan",
  "Gert",
  "Tshepo",
] as const;

// Use this when a sheet name is spelled differently from the person's ClickUp name, so the two
// are treated as one person. Left empty on purpose: a wrong link would assign work to the wrong
// person. Example: { Tshepo: ["Itumeleng Tshepe"] }
export const SHEET_ALIASES: Record<string, string[]> = {};

/** One selectable person in the picker. */
export interface Person {
  key: string; // stable React key
  label: string; // what the user sees
  value: string; // what is saved in `assignees` (the sheet name when there is one, else the full name)
  clickupUserId: string | null; // null = not on ClickUp
  avatarUrl: string | null;
}

/**
 * One person on the reusable list (the only people the dropdown offers). Chosen in the
 * "Manage people" pop-up from all ClickUp users, or added by name when they have no ClickUp account.
 */
export interface PickedPerson {
  id: string; // row id in the TicketPerson table
  displayName: string; // what the dropdown shows and what is saved in `assignees`
  clickupUserId: string | null; // null = no ClickUp account
  sortOrder: number;
}

/** A ClickUp workspace member as stored by the backend sync. */
export interface ClickUpMember {
  id: string; // the ClickUp user id
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean | null;
  updatedAt?: string | null;
}

/** What the form collects. */
export interface TicketFormValues {
  title: string;
  requiredOutcome: string;
  urgency: UrgencyValue | "";
  assignees: string[];
  mit: boolean;
  /** Filled in at submit time from the picked people who are on ClickUp. */
  assigneeClickupIds?: string[];
}

/** Who is submitting (taken from the signed-in user, never typed). */
export interface TicketSubmitter {
  id: string;
  name?: string;
  email?: string;
}

/** A ticket as the "My tasks" list shows it. */
export interface TicketSummary {
  id: string;
  ticketNumber: string | null;
  title: string;
  urgency: string;
  assignees: string[];
  status: TicketStatus;
  dueAt: string | null;
  urgencyMinutes: number | null;
  hasUpdate: boolean;
  followUpSentAt: string | null;
  gleedTaggedAt: string | null;
  clickupTaskUrl: string | null;
  lastError: string | null;
  createdAt: string;
}