// src/utils/helper/ticket.ts
// TICKETING: pure helpers for the Task Form. No React, no Amplify, so they are easy to test.
import { DateTime } from "luxon";
import {
  SHEET_ALIASES,
  SHEET_PEOPLE,
  URGENCY_MINUTES,
  URGENCY_OPTIONS,
  type ClickUpMember,
  type Person,
  type TicketFormValues,
  type TicketSubmitter,
  type TicketSummary,
  type UrgencyValue,
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

/**
 * Returns an object of field -> message. Empty object means the form is valid.
 * Pass `allowed` (the values of the people on screen) to also reject a name that is not on the list.
 */
export function validateTicketForm(
  v: TicketFormValues,
  allowed?: readonly string[],
): TicketFormErrors {
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
  else if (allowed && v.assignees.some((n) => !allowed.includes(n))) {
    errors.assignees = "One of the selected people is not on the list.";
  }

  return errors;
}

/**
 * What gets saved. Only user-typed fields plus status SUBMITTED: the task number,
 * due date and ClickUp details are filled in by the backend, never by the browser.
 */
export function buildTicketInput(v: TicketFormValues, who: TicketSubmitter, now: Date = new Date()) {
  const ids = [...new Set(v.assigneeClickupIds ?? [])];
  return {
    title: v.title.trim(),
    requiredOutcome: v.requiredOutcome.trim(),
    urgency: v.urgency as string,
    assignees: [...new Set(v.assignees)],
    ...(ids.length > 0 ? { assigneeClickupIds: ids } : {}),
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

// ---------------------------------------------------------------------------------------------
// People picker
// ---------------------------------------------------------------------------------------------

/** "Marco Rougier" -> "MR", "Gleed" -> "G". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * Everyone the picker offers: all active ClickUp members PLUS every name on the standard list.
 * A standard-list name that matches one ClickUp member (same full name, an alias, or the same
 * first name when only one member has it) is shown once, as that ClickUp user. Its `value` stays
 * the standard name so the backend keeps recognising it. Names with no ClickUp match stay on
 * the list without a ClickUp id.
 */
export function buildPeople(
  members: readonly ClickUpMember[],
  sheet: readonly string[] = SHEET_PEOPLE,
  aliases: Record<string, string[]> = SHEET_ALIASES,
): Person[] {
  const active = members.filter((m) => m.isActive !== false && m.name.trim() !== "");
  const firstOf = (n: string) => n.trim().split(/\s+/)[0].toLowerCase();

  const firstNameCount = new Map<string, number>();
  for (const m of active) {
    const f = firstOf(m.name);
    firstNameCount.set(f, (firstNameCount.get(f) ?? 0) + 1);
  }

  const claimed = new Set<string>();
  const people: Person[] = active.map((m) => {
    const full = m.name.trim();
    const fullLower = full.toLowerCase();
    const hit = sheet.find((s) => {
      if (claimed.has(s)) return false;
      const k = s.toLowerCase();
      if (k === fullLower) return true;
      if ((aliases[s] ?? []).some((a) => a.toLowerCase() === fullLower)) return true;
      return k === firstOf(full) && firstNameCount.get(k) === 1;
    });
    if (hit) claimed.add(hit);
    return {
      key: `clickup:${m.id}`,
      label: full,
      value: hit ?? full,
      clickupUserId: m.id,
      avatarUrl: m.avatarUrl ?? null,
    };
  });

  for (const s of sheet) {
    if (!claimed.has(s)) {
      people.push({ key: `sheet:${s}`, label: s, value: s, clickupUserId: null, avatarUrl: null });
    }
  }
  return people.sort((a, b) => a.label.localeCompare(b.label));
}

/** The newest sync time among the members, or null when none carry one. */
export function latestSync(members: readonly ClickUpMember[]): Date | null {
  let best = 0;
  for (const m of members) {
    const t = m.updatedAt ? Date.parse(m.updatedAt) : NaN;
    if (!Number.isNaN(t) && t > best) best = t;
  }
  return best > 0 ? new Date(best) : null;
}

// ---------------------------------------------------------------------------------------------
// Business hours (estimate only: the backend sets the real due date)
// ---------------------------------------------------------------------------------------------

const ZONE = "Africa/Johannesburg";
/** Must match the backend's business-hours setting (spreadsheet: 06:00 to 17:00). */
export const BUSINESS_START_HOUR = 6;
export const BUSINESS_END_HOUR = 17;
/** The spreadsheet only defines hours, not days. Set to true if the backend skips Sat/Sun. */
export const SKIP_WEEKENDS = false;

const atHour = (dt: DateTime, hour: number) =>
  dt.set({ hour, minute: 0, second: 0, millisecond: 0 });

/** The first moment at or after `from` that is inside business hours. */
function nextBusinessMoment(from: DateTime): DateTime {
  let t = from;
  for (let i = 0; i < 14; i++) {
    if (SKIP_WEEKENDS && t.weekday > 5) {
      t = atHour(t.plus({ days: 1 }), BUSINESS_START_HOUR);
      continue;
    }
    const open = atHour(t, BUSINESS_START_HOUR);
    const close = atHour(t, BUSINESS_END_HOUR);
    if (t.toMillis() < open.toMillis()) return open;
    if (t.toMillis() < close.toMillis()) return t;
    t = atHour(t.plus({ days: 1 }), BUSINESS_START_HOUR);
  }
  return t;
}

/** When a task of this urgency would be due if submitted at `now`. null for ASAP / unknown. */
export function estimateDue(urgency: string, now: Date = new Date()): string | null {
  const minutes = URGENCY_MINUTES[urgency as UrgencyValue];
  if (!minutes) return null;
  let remaining = minutes;
  let t = nextBusinessMoment(DateTime.fromJSDate(now, { zone: ZONE }));
  for (let i = 0; i < 400; i++) {
    const close = atHour(t, BUSINESS_END_HOUR);
    const room = close.diff(t, "minutes").minutes;
    if (remaining <= room) return t.plus({ minutes: remaining }).toUTC().toISO();
    remaining -= room;
    t = nextBusinessMoment(close);
  }
  return null;
}

/** Business minutes between two moments (time outside business hours does not count). */
export function businessMinutesBetween(from: Date, to: Date): number {
  const end = DateTime.fromJSDate(to, { zone: ZONE });
  let t = nextBusinessMoment(DateTime.fromJSDate(from, { zone: ZONE }));
  let total = 0;
  for (let i = 0; i < 400 && t.toMillis() < end.toMillis(); i++) {
    const close = atHour(t, BUSINESS_END_HOUR);
    const stop = end.toMillis() < close.toMillis() ? end : close;
    total += stop.diff(t, "minutes").minutes;
    t = nextBusinessMoment(close);
  }
  return Math.round(total);
}

// ---------------------------------------------------------------------------------------------
// "My tasks" list
// ---------------------------------------------------------------------------------------------

export type StatusTone = "info" | "ok" | "warn" | "bad" | "neutral";

/** True when the task is still being worked on and its due date has passed. */
export function isOverdue(t: TicketSummary, now: Date = new Date()): boolean {
  return t.status === "OPEN" && !!t.dueAt && Date.parse(t.dueAt) < now.getTime();
}

/** Plain-words status for the list. */
export function ticketStatus(
  t: TicketSummary,
  now: Date = new Date(),
): { label: string; tone: StatusTone } {
  if (t.status === "FAILED") return { label: "Failed", tone: "bad" };
  if (t.status === "SUBMITTED") return { label: "Creating in ClickUp", tone: "info" };
  if (t.status === "CLOSED") return { label: "Done", tone: "neutral" };
  if (t.hasUpdate) return { label: "Update received", tone: "ok" };
  if (t.gleedTaggedAt) return { label: "Escalated to Gleed", tone: "bad" };
  if (t.followUpSentAt) return { label: "Follow-up sent", tone: "warn" };
  if (isOverdue(t, now)) return { label: "Overdue", tone: "bad" };
  return { label: "On track", tone: "ok" };
}

/** 0-100 share of the urgency window used so far, or null when there is nothing to measure. */
export function ticketProgress(t: TicketSummary, now: Date = new Date()): number | null {
  if (t.status !== "OPEN" || !t.urgencyMinutes || t.urgencyMinutes <= 0) return null;
  const used = businessMinutesBetween(new Date(t.createdAt), now);
  return Math.max(0, Math.min(100, Math.round((used / t.urgencyMinutes) * 100)));
}