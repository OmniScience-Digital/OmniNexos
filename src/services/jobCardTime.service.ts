// src/services/jobCardTime.service.ts 
// Job cards: data access + passive time tracking side effects.
// The rules themselves live in src/utils/helper/jobCardTime.ts (pure, tested).
// Everything here is idempotent, so the web app, the mobile app and a future
// backend trigger can all call the same operations without double counting.
import { client } from "@/services/schema";
import { getUrl } from "aws-amplify/storage";
import type {
  Assignee, Certificate, DeliveryStatus, JobCard, JobCardScale, JobCardStatus, Submission, TelegramGroupRow,
  Technician, TimeEntry, TimeEntryStartReason, TimeUser, WorkItem, WorkItemType,
} from "@/types/jobcards.types";
import { telegramGroupId, validateGroupInput, type GroupInput } from "@/utils/helper/telegramGroup";
import type { PageCursor, StatusFilter, StatusQuery } from "@/utils/helper/jobCardPaging";
import { fetchJobCardsPage } from "@/utils/helper/jobCardPaging";
import {
  clampEnd, closedMinutesTotal, emailLookup, isOpen, isSamePerson, minutesBetween, nextSessionId, planIdleStops,
  planStop, SESSION_IDLE_MS, stoppable,
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
  assignedTo: o(r.assignedTo), assignedToName: o(r.assignedToName), assignedToEmail: o(r.assignedToEmail),
  assignedAt: o(r.assignedAt),
  totalTimePostedAt: o(r.totalTimePostedAt),
  totalMinutes: r.totalMinutes == null ? undefined : (r.totalMinutes as number),
});
export const mapScale = (r: Row): JobCardScale => ({
  id: s(r.id), jobCardId: s(r.jobCardId), scaleName: s(r.scaleName),
});
export const mapWorkItem = (r: Row): WorkItem => ({
  id: s(r.id), scaleId: s(r.scaleId), jobCardId: s(r.jobCardId), moduleType: r.moduleType as WorkItem["moduleType"],
  status: r.status as WorkItem["status"], sequence: (r.sequence as number) ?? 0,
  addedBy: o(r.addedBy), addedAt: o(r.addedAt), submittedBy: o(r.submittedBy), submittedAt: o(r.submittedAt),
  assignedTo: o(r.assignedTo), assignedToName: o(r.assignedToName),
});
export const mapTimeEntry = (r: Row): TimeEntry => ({
  id: s(r.id), jobCardId: s(r.jobCardId), moduleId: o(r.moduleId), userId: s(r.userId), userName: o(r.userName),
  userEmail: o(r.userEmail), startedAt: s(r.startedAt), lastActiveAt: o(r.lastActiveAt), endedAt: o(r.endedAt), minutes: r.minutes == null ? undefined : (r.minutes as number),
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
  pdfStored: r.pdfStored == null ? undefined : (r.pdfStored as boolean),
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
 * Passive START. Call when a technician enters a job card or submits a result. Adding or assigning work is NOT
 * engagement: it starts nothing. Starts a session only if that PERSON has no open entry on this
 * job card (a manual login and a social login of the same person count as one person).
 * Returns the new entry, or null if nothing was started.
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
  const emails = emailLookup(entries);
  if (entries.some((e) => isOpen(e) && isSamePerson(e, user, emails))) return null;

  const startedAt = args.at ?? new Date().toISOString();
  const res = await client.models.JobCardTimeEntry.create({
    id: nextSessionId(jobCardId, user.id, entries),
    jobCardId,
    userId: user.id,
    userName: user.name,
    userEmail: user.email ? user.email.trim().toLowerCase() : undefined,
    moduleId,
    startedAt,
    // only web sessions carry a heartbeat (the idle sweep ignores entries without JOB_CARD_OPENED)
    lastActiveAt: reason === "JOB_CARD_OPENED" ? startedAt : undefined,
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
  const [items, entries, lastResultAt] = await Promise.all([
    listWorkItems(jobCardId), listTimeEntries(jobCardId), latestResultAt(jobCardId),
  ]);
  const plan = planStop(items, entries, nowIso, lastResultAt);
  if (!plan) return false;
  for (const e of stoppable(entries, plan)) {
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

/**
 * When the newest result on the job card was submitted. A corrected result is a new result on an item that is
 * already SUBMITTED, so this can be later than every work item's own submittedAt. Never throws: it only refines
 * the stop time.
 */
export async function latestResultAt(jobCardId: string): Promise<string | null> {
  try {
    const res = await client.models.JobCardSubmission.submissionsByJobCard(
      { jobCardId }, { sortDirection: "DESC", limit: 1 },
    );
    if (res.errors?.length) return null;
    return ((res.data?.[0] as Row | undefined)?.submittedAt as string | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Heartbeat of a running web session: proves the person is still on the job card. */
export async function touchSession(entryId: string, at = new Date().toISOString()): Promise<void> {
  assertOk(await client.models.JobCardTimeEntry.update({ id: entryId, lastActiveAt: at }), "Could not update session");
}

/** End one web session (the person left the job card). Idempotent: a session that already ended is left alone. */
export async function endSession(
  entry: Pick<TimeEntry, "id" | "jobCardId" | "startedAt" | "endedAt">,
  reason: "SESSION_ENDED" | "IDLE_TIMEOUT" = "SESSION_ENDED",
  at = new Date().toISOString(),
): Promise<boolean> {
  if (entry.endedAt) return false;
  const endedAt = clampEnd(entry.startedAt, at);
  assertOk(
    await client.models.JobCardTimeEntry.update({
      id: entry.id, endedAt, minutes: minutesBetween(entry.startedAt, endedAt), endReason: reason,
    }),
    "Could not end session",
  );
  await recomputeTotalMinutes(entry.jobCardId);
  return true;
}

/**
 * Close web sessions whose heartbeat went quiet (tab closed, laptop asleep). Any viewer can run this; it ends each
 * session at its last heartbeat, so doing it twice or from two places gives the same result.
 */
export async function sweepIdleSessions(jobCardId: string, nowMs = Date.now(), idleMs = SESSION_IDLE_MS): Promise<number> {
  const entries = await listTimeEntries(jobCardId);
  const stops = planIdleStops(entries, nowMs, idleMs);
  for (const stop of stops) {
    const e = entries.find((x) => x.id === stop.entryId)!;
    assertOk(
      await client.models.JobCardTimeEntry.update({
        id: e.id, endedAt: stop.endedAt, minutes: minutesBetween(e.startedAt, stop.endedAt), endReason: "IDLE_TIMEOUT",
      }),
      "Could not close an idle session",
    );
  }
  if (stops.length > 0) await recomputeTotalMinutes(jobCardId);
  return stops.length;
}

export async function addScale(jobCardId: string, scaleName: string): Promise<void> {
  assertOk(await client.models.JobCardScale.create({ jobCardId, scaleName: scaleName.trim() }), "Could not add scale");
}

/**
 * Add a work item to a scale. Adding work starts NO timer and assigns it to no one: the whole job card is assigned
 * (see assignJobCard), every technician can work on every item, and time starts only when a technician ENTERS the
 * job card (see useJobCardSession). An office user setting up the work must not clock hours.
 */
export async function addWorkItem(args: {
  jobCard: Pick<JobCard, "id" | "status">;
  scaleId: string;
  type: WorkItemType;
  user: TimeUser;
}): Promise<void> {
  const { jobCard, scaleId, type, user } = args;
  if (jobCard.status !== "OPEN") throw new Error("This job card is closed.");
  const existing = (await listWorkItems(jobCard.id)).filter((i) => i.scaleId === scaleId);
  const res = await client.models.JobCardModule.create({
    jobCardId: jobCard.id, scaleId, moduleType: type, status: "PENDING",
    sequence: existing.reduce((m, i) => Math.max(m, i.sequence), 0) + 1, addedBy: user.id, addedAt: new Date().toISOString(),
  });
  assertOk(res, "Could not add work item");
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

/** A job card cannot be assigned until a Telegram group is selected for it (the group is where its updates go). */
export const ASSIGN_NEEDS_GROUP = "Select a Telegram group for this job card before assigning it.";

export type AssignNotice = "sent" | "no-token" | "no-email" | "failed" | "skipped";

/**
 * Assign the whole job card to a technician, or pass null to unassign. One notification goes to the new assignee.
 * Assigning needs a Telegram group selected first (unassigning does not). Assigning does not start time and does not
 * stop anyone else from opening or working on the job card.
 */
export async function assignJobCard(
  jobCard: Pick<JobCard, "id" | "status" | "jcNumber" | "customerName" | "assignedTo" | "telegramGroupId">,
  assignee: Assignee | null,
): Promise<AssignNotice> {
  if (jobCard.status !== "OPEN") throw new Error("This job card is closed.");
  if (assignee && !jobCard.telegramGroupId) throw new Error(ASSIGN_NEEDS_GROUP);
  // Picking the same person again changes nothing: no new assigned date, so no second alert on the phone.
  if (assignee && assignee.id === jobCard.assignedTo) return "skipped";
  assertOk(
    await client.models.JobCard.update({
      id: jobCard.id,
      assignedTo: assignee?.id ?? null,
      assignedToName: assignee?.name ?? null,
      assignedToEmail: assignee?.email ? assignee.email.trim().toLowerCase() : null,
      assignedAt: assignee ? new Date().toISOString() : null,
    }),
    "Could not assign job card",
  );
  // only when it really goes to someone new (not when unassigned)
  if (!assignee) return "skipped";
  return notifyAssignee({ assignee, jobCardId: jobCard.id, jcNumber: jobCard.jcNumber, customerName: jobCard.customerName });
}

/**
 * Push "job card assigned to you" to the technician's phone(s). The mobile app saves push tokens against the user's EMAIL,
 * so that is what is looked up. Never throws: the answer says what happened.
 */
export async function notifyAssignee(a: {
  assignee: Assignee | null | undefined;
  jobCardId: string;
  jcNumber: string;
  customerName?: string | null;
}): Promise<AssignNotice> {
  if (!a.assignee) return "skipped";
  if (!a.assignee.email) return "no-email";
  try {
    const rows = await allPages((nextToken) =>
      client.models.PushToken.pushTokensByUser({ userId: a.assignee!.email! }, { nextToken }) as Promise<Page>,
    );
    const pushTokens = [...new Set(rows.map((r) => r.token as string).filter(Boolean))];
    if (pushTokens.length === 0) return "no-token";
    const res = await client.mutations.notifyWorkAssigned({
      pushTokens, jobCardId: a.jobCardId, jcNumber: a.jcNumber, customerName: a.customerName ?? undefined,
    });
    if (res.errors?.length) return "failed";
    const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
    return (data as { success?: boolean } | null)?.success ? "sent" : "failed";
  } catch (e) {
    console.error("[assignment push] failed", e);
    return "failed";
  }
}

/** Plain-words note for the office when the technician could not be notified (null = nothing to say). */
export function assignNoticeMessage(notice: AssignNotice, name: string): string | null {
  switch (notice) {
    case "no-token": return `${name} has not signed in on the mobile app yet, so no notification was sent. They will see the job card when they open the app.`;
    case "no-email": return `${name} has no email on record, so no notification could be sent.`;
    case "failed": return `Assigned to ${name}, but the notification could not be sent.`;
    default: return null;
  }
}

let technicianCache: { at: number; promise: Promise<Technician[]> } | null = null;
const TECHNICIAN_CACHE_MS = 5 * 60_000;

/** System login users who can be assigned work (enabled users only; names and emails, nothing else). Cached for 5 minutes. */
export function listTechnicians(force = false): Promise<Technician[]> {
  if (!force && technicianCache && Date.now() - technicianCache.at < TECHNICIAN_CACHE_MS) return technicianCache.promise;
  const promise = (async () => {
    const res = await client.queries.techniciansList();
    assertOk(res, "Could not load users");
    return ((res.data ?? []) as (Row | null)[])
      .filter((t): t is Row => Boolean(t))
      .map((t) => ({ id: s(t.id), name: s(t.name), email: o(t.email) }));
  })();
  technicianCache = { at: Date.now(), promise };
  promise.catch(() => { if (technicianCache?.promise === promise) technicianCache = null; }); // never cache a failure
  return promise;
}

/**
 * Add a Telegram group by hand (name + chat ID). If the chat ID is already known (added by hand before, or
 * recorded when the bot joined the group) the existing group is returned instead of creating a second one.
 */
export async function addTelegramGroup(input: GroupInput): Promise<{ group: TelegramGroupRow; existed: boolean }> {
  const v = validateGroupInput(input);
  if (!v.ok) throw new Error(v.error);
  const { groupName, chatId } = v.value;

  // The row id is derived from the chat ID (the backend bot capture uses the same rule), so a group added
  // by hand and the same group captured when the bot joins can never become two rows.
  const id = telegramGroupId(chatId);
  const byId = await client.models.TelegramGroup.get({ id });
  assertOk(byId, "Could not check existing groups");
  if (byId.data) return { group: mapTelegramGroup(byId.data as Row), existed: true };
  // Older rows created before this rule have random ids: still find them by chat ID.
  const found = await client.models.TelegramGroup.telegramGroupsByChatId({ chatId });
  assertOk(found, "Could not check existing groups");
  const existing = found.data?.[0];
  if (existing) return { group: mapTelegramGroup(existing as Row), existed: true };

  const res = await client.models.TelegramGroup.create({ id, chatId, groupName, active: true, addedAt: new Date().toISOString() });
  assertOk(res, "Could not add the group");
  if (!res.data) throw new Error("Could not add the group.");
  return { group: mapTelegramGroup(res.data as Row), existed: false };
}