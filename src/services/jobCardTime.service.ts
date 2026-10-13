// src/services/jobCardTime.service.ts  (NEW FILE)
// Job cards: data access + passive time tracking side effects.
// The rules themselves live in src/utils/helper/jobCardTime.ts (pure, tested).
// Everything here is idempotent, so the web app, the mobile app and a future
// backend trigger can all call the same operations without double counting.
import { client } from "@/services/schema";
import type {
  JobCard, JobCardScale, TimeEntry, TimeEntryStartReason, TimeUser, WorkItem, WorkItemType,
} from "@/types/jobcards.types";
import {
  clampEnd, closedMinutesTotal, isOpen, minutesBetween, nextSessionId, planStop,
} from "@/utils/helper/jobCardTime";

type Row = Record<string, unknown>;
const s = (v: unknown) => v as string;
const o = (v: unknown) => (v == null ? undefined : (v as string));

export const mapJobCard = (r: Row): JobCard => ({
  id: s(r.id), jcNumber: s(r.jcNumber), quoteNumber: o(r.quoteNumber), customerName: o(r.customerName),
  title: o(r.title), status: r.status as JobCard["status"], openedAt: o(r.openedAt), closedAt: o(r.closedAt),
  closedBy: o(r.closedBy), clickupTaskId: o(r.clickupTaskId),
  totalMinutes: r.totalMinutes == null ? undefined : (r.totalMinutes as number),
});
export const mapScale = (r: Row): JobCardScale => ({
  id: s(r.id), jobCardId: s(r.jobCardId), scaleName: s(r.scaleName),
});
export const mapWorkItem = (r: Row): WorkItem => ({
  id: s(r.id), scaleId: s(r.scaleId), jobCardId: s(r.jobCardId), moduleType: r.moduleType as WorkItem["moduleType"],
  status: r.status as WorkItem["status"], sequence: (r.sequence as number) ?? 0,
  addedBy: o(r.addedBy), addedAt: o(r.addedAt), submittedBy: o(r.submittedBy), submittedAt: o(r.submittedAt),
});
export const mapTimeEntry = (r: Row): TimeEntry => ({
  id: s(r.id), jobCardId: s(r.jobCardId), moduleId: o(r.moduleId), userId: s(r.userId), userName: o(r.userName),
  startedAt: s(r.startedAt), endedAt: o(r.endedAt), minutes: r.minutes == null ? undefined : (r.minutes as number),
  startReason: o(r.startReason) as TimeEntry["startReason"], endReason: o(r.endReason) as TimeEntry["endReason"],
});

type Page = { data?: unknown[] | null; nextToken?: string | null; errors?: { message?: string }[] };

/** Follow nextToken to the end (same reason as src/state/api.ts: no silently dropped rows). */
async function allPages(fetchPage: (nextToken?: string) => Promise<Page>): Promise<Row[]> {
  const out: Row[] = [];
  let token: string | undefined;
  do {
    const res = await fetchPage(token);
    if (res.errors?.length) throw new Error(res.errors.map((e) => e.message).join("; "));
    out.push(...((res.data ?? []) as Row[]));
    token = res.nextToken ?? undefined;
  } while (token);
  return out;
}

function assertOk(res: { errors?: { message?: string }[] }, what: string) {
  if (res.errors?.length) throw new Error(`${what}: ${res.errors.map((e) => e.message).join("; ")}`);
}

export async function listTimeEntries(jobCardId: string): Promise<TimeEntry[]> {
  const rows = await allPages((nextToken) =>
    client.models.JobCardTimeEntry.timeEntriesByJobCard({ jobCardId }, { nextToken }) as Promise<Page>,
  );
  return rows.map(mapTimeEntry);
}

export async function listWorkItems(jobCardId: string): Promise<WorkItem[]> {
  const rows = await allPages((nextToken) =>
    client.models.JobCardModule.modulesByJobCard({ jobCardId }, { nextToken }) as Promise<Page>,
  );
  return rows.map(mapWorkItem);
}

/**
 * Passive START. Call whenever a user engages with a job card: after they add a
 * work item, or submit a result. Starts a session only if that user has no open
 * entry on this job card. Returns the new entry, or null if nothing was started.
 */
export async function recordEngagement(args: {
  jobCardId: string;
  user: TimeUser;
  reason: TimeEntryStartReason;
  moduleId?: string;
  at?: string;
}): Promise<TimeEntry | null> {
  const { jobCardId, user, reason, moduleId } = args;
  const entries = await listTimeEntries(jobCardId);
  if (entries.some((e) => e.userId === user.id && isOpen(e))) return null;

  const res = await client.models.JobCardTimeEntry.create({
    id: nextSessionId(jobCardId, user.id, entries),
    jobCardId,
    userId: user.id,
    userName: user.name,
    moduleId,
    startedAt: args.at ?? new Date().toISOString(),
    startReason: reason,
  });
  // Another tab/device created the same session id first: that is fine, one open entry exists.
  if (res.errors?.some((e) => /ConditionalCheckFailed|already exists/i.test(e.message ?? ""))) return null;
  assertOk(res, "Could not start time tracking");
  return res.data ? mapTimeEntry(res.data as Row) : null;
}

/** Rebuilds JobCard.totalMinutes from the entries (never incremented, so it cannot drift). */
export async function recomputeTotalMinutes(jobCardId: string): Promise<number> {
  const total = closedMinutesTotal(await listTimeEntries(jobCardId));
  assertOk(await client.models.JobCard.update({ id: jobCardId, totalMinutes: total }), "Could not update total time");
  return total;
}

/**
 * Passive STOP. Applies the stop rule: when every work item is submitted (or all were removed)
 * the open entries end. Safe to call any time, from anywhere; returns true if it closed entries.
 */
export async function syncTimeTracking(jobCardId: string, nowIso = new Date().toISOString()): Promise<boolean> {
  const [items, entries] = await Promise.all([listWorkItems(jobCardId), listTimeEntries(jobCardId)]);
  const plan = planStop(items, entries, nowIso);
  if (!plan) return false;
  for (const e of entries.filter(isOpen)) {
    const endedAt = clampEnd(e.startedAt, plan.stopAt);
    assertOk(
      await client.models.JobCardTimeEntry.update({
        id: e.id, endedAt, minutes: minutesBetween(e.startedAt, endedAt), endReason: plan.reason,
      }),
      "Could not stop time tracking",
    );
  }
  await recomputeTotalMinutes(jobCardId);
  return true;
}

export async function addScale(jobCardId: string, scaleName: string): Promise<void> {
  assertOk(await client.models.JobCardScale.create({ jobCardId, scaleName: scaleName.trim() }), "Could not add scale");
}

/** Assign a work item to a scale. Starts this user's time entry if they have none open. */
export async function addWorkItem(args: {
  jobCard: Pick<JobCard, "id" | "status">;
  scaleId: string;
  type: WorkItemType;
  user: TimeUser;
}): Promise<void> {
  const { jobCard, scaleId, type, user } = args;
  if (jobCard.status !== "OPEN") throw new Error("This job card is closed.");
  const existing = (await listWorkItems(jobCard.id)).filter((i) => i.scaleId === scaleId);
  const at = new Date().toISOString();
  const res = await client.models.JobCardModule.create({
    jobCardId: jobCard.id, scaleId, moduleType: type, status: "PENDING",
    sequence: existing.reduce((m, i) => Math.max(m, i.sequence), 0) + 1, addedBy: user.id, addedAt: at,
  });
  assertOk(res, "Could not add work item");
  await recordEngagement({
    jobCardId: jobCard.id, user, reason: "WORK_ITEM_ADDED", moduleId: (res.data as Row | null)?.id as string, at,
  });
}

/** Remove a work item that has no result yet. May complete the job card (see stop rule). */
export async function removeWorkItem(item: Pick<WorkItem, "id" | "jobCardId" | "status">): Promise<void> {
  if (item.status !== "PENDING") throw new Error("A work item with a submitted result cannot be removed.");
  assertOk(await client.models.JobCardModule.delete({ id: item.id }), "Could not remove work item");
  await syncTimeTracking(item.jobCardId);
}

/** Close a job card (web only). Open time entries end here. */
export async function closeJobCard(jobCardId: string, user: TimeUser): Promise<void> {
  const nowIso = new Date().toISOString();
  const entries = await listTimeEntries(jobCardId);
  for (const e of entries.filter(isOpen)) {
    const endedAt = clampEnd(e.startedAt, nowIso);
    assertOk(
      await client.models.JobCardTimeEntry.update({
        id: e.id, endedAt, minutes: minutesBetween(e.startedAt, endedAt), endReason: "JOB_CLOSED",
      }),
      "Could not stop time tracking",
    );
  }
  assertOk(
    await client.models.JobCard.update({ id: jobCardId, status: "CLOSED", closedAt: nowIso, closedBy: user.id }),
    "Could not close job card",
  );
  await recomputeTotalMinutes(jobCardId);
}