// src/utils/helper/jobCardTime.ts 
// Passive time tracking for job cards: pure rules, no I/O.
//
// Rules
//  1. A user "engages" with a job card when they ENTER it (web app), add a work
//     item, or submit a result. If that person has no open entry on the job
//     card, one is started. There is no start/stop button. Being assigned a job
//     card does NOT start time (technicians are often assigned days before they
//     travel to site).
//  1b. A web session is one visit: it ends when the user leaves the job card, or
//     is closed as idle when its heartbeat goes stale. Each site day is therefore
//     its own session(s), and the job card total is the sum of all sessions.
//  2. All open entries on a job card stop together when its LAST work item is
//     submitted. The stop time is that submission's time, not "now", so it does
//     not matter which device or user notices first.
//  3. Open entries also stop if the job card is closed, or if every work item
//     is removed.
//  4. Tracking is per user per job card. "Person time" is the sum of every
//     user's entries; "elapsed" is first start to last stop.
import type { JobCardStatus, TimeEntry, TimeEntryEndReason, WorkItem } from "@/types/jobcards.types";

const MS_MIN = 60_000;

/** The web page writes a heartbeat this often while a job card is open and visible. */
export const HEARTBEAT_MS = 60_000;
/** A web session with no heartbeat for this long is treated as abandoned (tab closed, laptop asleep). */
export const SESSION_IDLE_MS = 5 * MS_MIN;
/** Time zone used to decide which "site day" a session belongs to. */
export const SITE_TIME_ZONE = "Africa/Johannesburg";

export const isOpen = (e: Pick<TimeEntry, "endedAt">) => !e.endedAt;

/** True when there is at least one work item and all of them are submitted. */
export function allSubmitted(items: Pick<WorkItem, "status">[]): boolean {
  return items.length > 0 && items.every((i) => i.status === "SUBMITTED");
}

/** Latest submittedAt among submitted work items, or null. */
export function lastSubmittedAt(items: Pick<WorkItem, "status" | "submittedAt">[]): string | null {
  let best: string | null = null;
  for (const i of items) {
    if (i.status !== "SUBMITTED" || !i.submittedAt) continue;
    if (best === null || Date.parse(i.submittedAt) > Date.parse(best)) best = i.submittedAt;
  }
  return best;
}

/** Whole minutes between two instants, never negative. */
export function minutesBetween(startIso: string, endIso: string): number {
  return Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / MS_MIN));
}

/** Seconds an entry has run: to its end, or to `nowMs` while it is open. */
export function entrySeconds(e: Pick<TimeEntry, "startedAt" | "endedAt">, nowMs: number): number {
  const end = e.endedAt ? Date.parse(e.endedAt) : nowMs;
  return Math.max(0, Math.floor((end - Date.parse(e.startedAt)) / 1000));
}

/** Deterministic id for a user's next session, so concurrent starts collide. */
export function nextSessionId(jobCardId: string, userId: string, entries: Pick<TimeEntry, "userId">[]): string {
  const n = entries.filter((e) => e.userId === userId).length + 1;
  return `${jobCardId}#${userId}#${n}`;
}

export interface StopPlan {
  /** ISO time the open entries end at. */
  stopAt: string;
  reason: TimeEntryEndReason;
}

/**
 * Decide whether open entries should stop now.
 * Returns null when nothing is open or the job card is not finished yet.
 */
export function planStop(
  items: Pick<WorkItem, "status" | "submittedAt">[],
  entries: Pick<TimeEntry, "endedAt">[],
  nowIso: string,
  /**
   * submittedAt of the newest result on the job card. A corrected result is a NEW result for an item that is
   * already SUBMITTED, so the item's own submittedAt can be older than the correction; use whichever is later.
   */
  lastResultAt?: string | null,
): StopPlan | null {
  if (!entries.some(isOpen)) return null;
  if (items.length === 0) return { stopAt: nowIso, reason: "NO_WORK_ITEMS" };
  if (allSubmitted(items)) {
    const itemsAt = lastSubmittedAt(items);
    const stopAt =
      itemsAt && lastResultAt ? (Date.parse(lastResultAt) > Date.parse(itemsAt) ? lastResultAt : itemsAt)
      : itemsAt ?? lastResultAt ?? nowIso;
    return { stopAt, reason: "ALL_SUBMITTED" };
  }
  return null;
}

/** Clamp a stop time so an entry never ends before it started. */
export function clampEnd(startedAt: string, stopAt: string): string {
  return Date.parse(stopAt) < Date.parse(startedAt) ? startedAt : stopAt;
}

export interface UserTime {
  /** One of the person's ids (their first entry's). */
  userId: string;
  userName: string;
  seconds: number;
  sessions: number;
  running: boolean;
}

/** id (Cognito sub) -> lower-case email, learned from the entries themselves plus any extra source (the user list). */
export function emailLookup(
  entries: Pick<TimeEntry, "userId" | "userEmail">[],
  extra?: Iterable<[string, string | null | undefined]>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [id, email] of extra ?? []) if (email) map.set(id, email.trim().toLowerCase());
  for (const e of entries) if (e.userEmail) map.set(e.userId, e.userEmail.trim().toLowerCase());
  return map;
}

/**
 * The key that identifies a PERSON. A manual login and a social login are two Cognito identities with two
 * different ids, so their time used to be split. The email is the same for both, so it wins; an id with no known
 * email falls back to the id itself.
 */
export function personKey(e: Pick<TimeEntry, "userId" | "userEmail">, emails?: Map<string, string>): string {
  const email = e.userEmail?.trim().toLowerCase() || emails?.get(e.userId);
  return email ? `email:${email}` : `id:${e.userId}`;
}

/** True when the entry belongs to this person (same login, or the same email). */
export function isSamePerson(
  e: Pick<TimeEntry, "userId" | "userEmail">,
  user: { id: string; email?: string | null },
  emails?: Map<string, string>,
): boolean {
  if (e.userId === user.id) return true; // the same login is certainly the same person, even for rows saved before emails
  return personKey(e, emails) === personKey({ userId: user.id, userEmail: user.email }, emails);
}

/** Per-person totals, longest first. Several logins of one person are added together. */
export function totalsByUser(
  entries: TimeEntry[],
  nowMs: number,
  extraEmails?: Iterable<[string, string | null | undefined]>,
): UserTime[] {
  const emails = emailLookup(entries, extraEmails);
  const map = new Map<string, UserTime>();
  for (const e of entries) {
    const key = personKey(e, emails);
    const cur = map.get(key) ?? {
      userId: e.userId,
      userName: e.userName || e.userId,
      seconds: 0,
      sessions: 0,
      running: false,
    };
    cur.seconds += entrySeconds(e, nowMs);
    cur.sessions += 1;
    cur.running = cur.running || isOpen(e);
    if (e.userName) cur.userName = e.userName;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.seconds - a.seconds);
}

/** Sum of every user's time (person-time), in seconds. */
export function personSeconds(entries: TimeEntry[], nowMs: number): number {
  return entries.reduce((sum, e) => sum + entrySeconds(e, nowMs), 0);
}

/** First start to last stop (or now, if anything is still running). */
export function elapsedSpan(
  entries: TimeEntry[],
  nowMs: number,
): { startedAt: string; endedAt: string | null; seconds: number } | null {
  if (entries.length === 0) return null;
  const startMs = Math.min(...entries.map((e) => Date.parse(e.startedAt)));
  const anyOpen = entries.some(isOpen);
  const endMs = anyOpen ? nowMs : Math.max(...entries.map((e) => Date.parse(e.endedAt as string)));
  return {
    startedAt: new Date(startMs).toISOString(),
    endedAt: anyOpen ? null : new Date(endMs).toISOString(),
    seconds: Math.max(0, Math.floor((endMs - startMs) / 1000)),
  };
}

/** Stored total: whole minutes across CLOSED entries only. */
export function closedMinutesTotal(entries: Pick<TimeEntry, "endedAt" | "minutes">[]): number {
  return entries.reduce((sum, e) => sum + (e.endedAt ? (e.minutes ?? 0) : 0), 0);
}

/** "2 h 05 min", "45 min", "< 1 min". */
export function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  if (mins < 1) return totalSeconds < 1 ? "0 min" : "< 1 min";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

/** Same, from stored minutes (used in lists where entries are not loaded). */
export const formatMinutes = (minutes?: number | null) => formatDuration((minutes ?? 0) * 60);

// ---------------------------------------------------------------------------
// Web sessions (one per visit to a job card)
// ---------------------------------------------------------------------------

/**
 * Should entering the job card start a session? Only for an open job card whose work is not already all
 * submitted (otherwise the stop rule would end the session at once, at a time before it began), and only
 * when this person has nothing running.
 */
export function shouldStartSession(args: {
  status: JobCardStatus;
  items: Pick<WorkItem, "status">[];
  entries: Pick<TimeEntry, "userId" | "userEmail" | "endedAt">[];
  user: { id: string; email?: string | null };
}): boolean {
  const { status, items, entries, user } = args;
  if (status !== "OPEN") return false;
  if (allSubmitted(items)) return false;
  const emails = emailLookup(entries);
  return !entries.some((e) => isOpen(e) && isSamePerson(e, user, emails));
}

export interface IdleStop {
  entryId: string;
  endedAt: string;
}

/**
 * Web sessions whose heartbeat went quiet. They end at their LAST heartbeat (not "now"), so a closed laptop
 * does not count as working time. Only entries started by the web app (JOB_CARD_OPENED) are swept: entries
 * written by the mobile app have no heartbeat and end by the stop rule instead.
 */
export function planIdleStops(
  entries: Pick<TimeEntry, "id" | "startedAt" | "lastActiveAt" | "endedAt" | "startReason">[],
  nowMs: number,
  idleMs = SESSION_IDLE_MS,
): IdleStop[] {
  const out: IdleStop[] = [];
  for (const e of entries) {
    if (!isOpen(e) || e.startReason !== "JOB_CARD_OPENED") continue;
    const last = e.lastActiveAt ?? e.startedAt;
    if (nowMs - Date.parse(last) < idleMs) continue;
    out.push({ entryId: e.id, endedAt: clampEnd(e.startedAt, last) });
  }
  return out;
}

/** "2026-10-22" in site time. */
export function siteDay(iso: string, timeZone = SITE_TIME_ZONE): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone });
}

export interface DaySessions<T extends TimeEntry = TimeEntry> {
  day: string; // "2026-10-22"
  seconds: number;
  people: number;
  sessions: T[]; // newest first
}

/** Sessions grouped by site day (newest day first), with the time spent on each day. */
export function groupSessionsByDay<T extends TimeEntry>(entries: T[], nowMs: number, timeZone = SITE_TIME_ZONE): DaySessions<T>[] {
  const emails = emailLookup(entries);
  const days = new Map<string, T[]>();
  for (const e of entries) {
    const d = siteDay(e.startedAt, timeZone);
    days.set(d, [...(days.get(d) ?? []), e]);
  }
  return [...days.entries()]
    .map(([day, list]) => ({
      day,
      seconds: list.reduce((sum, e) => sum + entrySeconds(e, nowMs), 0),
      people: new Set(list.map((e) => personKey(e, emails))).size,
      sessions: [...list].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)),
    }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));
}