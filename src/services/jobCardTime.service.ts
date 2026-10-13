// src/services/jobCardTime.service.ts
// Job cards: data access + passive time tracking side effects.
// The rules themselves live in src/utils/helper/jobCardTime.ts (pure, tested).
// Everything here is idempotent, so the web app, the mobile app and a future
// backend trigger can all call the same operations without double counting.
import { client } from "@/services/schema";
import { getUrl } from "aws-amplify/storage";
import type {
  Certificate, DeliveryStatus, JobCard, JobCardScale, JobCardStatus, Submission, TelegramGroupRow, TimeEntry,
  TimeEntryStartReason, TimeUser, WorkItem, WorkItemType,
} from "@/types/jobcards.types";
import type { PageCursor, StatusFilter, StatusQuery } from "@/utils/helper/jobCardPaging";
import { fetchJobCardsPage } from "@/utils/helper/jobCardPaging";
import {
  clampEnd, closedMinutesTotal, isOpen, minutesBetween, nextSessionId, planStop,
} from "@/utils/helper/jobCardTime";

/** False until the backend with the job card models is deployed and amplify_outputs.json is regenerated. */
export const jobCardBackendReady = (): boolean => {
  const models = client.models as unknown as Record<string, unknown>;
  return [
    "JobCard", "JobCardScale", "JobCardModule", "JobCardTimeEntry",
    "JobCardSubmission", "CalibrationCertificate", "TelegramGroup",
  ].every((k) => Boolean(models[k]));
};

type Row = Record<string, unknown>;
const s = (v: unknown) => v as string;
const o = (v: unknown) => (v == null ? undefined : (v as string));

export const mapJobCard = (r: Row): JobCard => ({
  id: s(r.id), jcNumber: s(r.jcNumber), quoteNumber: o(r.quoteNumber), customerName: o(r.customerName),
  title: o(r.title), status: r.status as JobCard["status"], openedAt: o(r.openedAt), closedAt: o(r.closedAt),
  closedBy: o(r.closedBy), clickupTaskId: o(r.clickupTaskId), telegramGroupId: o(r.telegramGroupId),
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

export const mapSubmission = (r: Row): Submission => {
  // a.json() comes back as a JSON string from AppSync; accept an already-parsed object too.
  let payload: Record<string, unknown> = {};
  try {
    const raw = typeof r.payload === "string" ? JSON.parse(r.payload as string) : r.payload;
    if (raw && typeof raw === "object") payload = raw as Record<string, unknown>;
  } catch { /* leave empty: the card will just show no fields */ }
  return {
    id: s(r.id), moduleId: s(r.moduleId), scaleId: s(r.scaleId), jobCardId: s(r.jobCardId),
    moduleType: r.moduleType as Submission["moduleType"], submittedBy: s(r.submittedBy), submittedAt: s(r.submittedAt),
    payload, clickupStatus: o(r.clickupStatus) as DeliveryStatus | undefined,
    telegramStatus: o(r.telegramStatus) as DeliveryStatus | undefined,
  };
};
export const mapCertificate = (r: Row): Certificate => ({
  id: s(r.id), certificateNumber: s(r.certificateNumber), jobCardId: s(r.jobCardId), scaleId: s(r.scaleId),
  status: r.status as Certificate["status"], version: (r.version as number) ?? 1, issuedAt: s(r.issuedAt), pdfKey: s(r.pdfKey),
});
export const mapTelegramGroup = (r: Row): TelegramGroupRow => ({
  id: s(r.id), chatId: s(r.chatId), groupName: o(r.groupName), active: r.active == null ? undefined : (r.active as boolean),
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

/** Remove a scale together with its work items. Refused if any result has already been submitted. */
export async function removeScale(scale: Pick<JobCardScale, "id" | "jobCardId">): Promise<void> {
  // Re-read from the database: the page's copy may be stale (a technician may have just submitted).
  const mine = (await listWorkItems(scale.jobCardId)).filter((i) => i.scaleId === scale.id);
  if (mine.some((i) => i.status === "SUBMITTED")) {
    throw new Error("This scale has submitted results and cannot be removed.");
  }
  for (const i of mine) assertOk(await client.models.JobCardModule.delete({ id: i.id }), "Could not remove work item");
  assertOk(await client.models.JobCardScale.delete({ id: scale.id }), "Could not remove scale");
  await syncTimeTracking(scale.jobCardId);
}

/** Link (or unlink, with null) the Telegram group a job card's results are posted to. */
export async function setTelegramGroup(jobCardId: string, groupId: string | null): Promise<void> {
  assertOk(await client.models.JobCard.update({ id: jobCardId, telegramGroupId: groupId }), "Could not link Telegram group");
}

export async function listTelegramGroups(): Promise<TelegramGroupRow[]> {
  const rows = await allPages((nextToken) => client.models.TelegramGroup.list({ nextToken }) as Promise<Page>);
  return rows.map(mapTelegramGroup).sort((a, b) => (a.groupName ?? a.chatId).localeCompare(b.groupName ?? b.chatId));
}

/** One page of one status, newest first, straight from the status index (never a table scan). */
const queryByStatus: StatusQuery = async (status: JobCardStatus, limit: number, nextToken: string | null) => {
  const res = await client.models.JobCard.jobCardsByStatus(
    { status },
    { sortDirection: "DESC", limit, nextToken: nextToken ?? undefined },
  );
  assertOk(res, "Could not load job cards");
  return { items: (res.data ?? []).map((r) => mapJobCard(r as Row)), nextToken: res.nextToken ?? null };
};

/** A page of job cards. Closed ones are only read when the filter is CLOSED or ALL. */
export function loadJobCardsPage(filter: StatusFilter, cursor: PageCursor | null, limit: number) {
  return fetchJobCardsPage(queryByStatus, filter, cursor, limit);
}

/** Exact lookup by job card number (JC-QU-0032 or just QU-0032) or by quote number, using indexes. */
export async function findJobCards(term: string): Promise<JobCard[]> {
  const t = term.trim();
  if (!t) return [];
  const byNumber = [t, ...(t.toUpperCase().startsWith("JC-") ? [] : [`JC-${t}`])];
  const found = new Map<string, JobCard>();
  for (const jcNumber of byNumber) {
    const res = await client.models.JobCard.jobCardsByNumber({ jcNumber });
    assertOk(res, "Search failed");
    (res.data ?? []).forEach((r) => found.set(s(r.id), mapJobCard(r as Row)));
  }
  const res = await client.models.JobCard.jobCardsByQuoteNumber({ quoteNumber: t });
  assertOk(res, "Search failed");
  (res.data ?? []).forEach((r) => found.set(s(r.id), mapJobCard(r as Row)));
  return [...found.values()];
}

/** Short-lived signed link to a file in storage (photos, certificate PDFs). */
export async function getFileUrl(key: string): Promise<string> {
  return (await getUrl({ path: key })).url.toString();
}