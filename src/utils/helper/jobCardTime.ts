// src/utils/helper/jobCardTime.ts  (NEW FILE)
// Passive time tracking for job cards: pure rules, no I/O.
//
// Rules
//  1. A user "engages" with a job card when they add a work item (web or
//     mobile) or submit a result. If that user has no open entry on the job
//     card, one is started. There is no start/stop button.
//  2. All open entries on a job card stop together when its LAST work item is
//     submitted. The stop time is that submission's time, not "now", so it does
//     not matter which device or user notices first.
//  3. Open entries also stop if the job card is closed, or if every work item
//     is removed.
//  4. Tracking is per user per job card. "Person time" is the sum of every
//     user's entries; "elapsed" is first start to last stop.
import type { TimeEntry, TimeEntryEndReason, WorkItem } from "@/types/jobcards.types";

const MS_MIN = 60_000;

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
): StopPlan | null {
  if (!entries.some(isOpen)) return null;
  if (items.length === 0) return { stopAt: nowIso, reason: "NO_WORK_ITEMS" };
  if (allSubmitted(items)) {
    return { stopAt: lastSubmittedAt(items) ?? nowIso, reason: "ALL_SUBMITTED" };
  }
  return null;
}

/** Clamp a stop time so an entry never ends before it started. */
export function clampEnd(startedAt: string, stopAt: string): string {
  return Date.parse(stopAt) < Date.parse(startedAt) ? startedAt : stopAt;
}

export interface UserTime {
  userId: string;
  userName: string;
  seconds: number;
  sessions: number;
  running: boolean;
}

/** Per-user totals, longest first. */
export function totalsByUser(entries: TimeEntry[], nowMs: number): UserTime[] {
  const map = new Map<string, UserTime>();
  for (const e of entries) {
    const cur = map.get(e.userId) ?? {
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
    map.set(e.userId, cur);
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