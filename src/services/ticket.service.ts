// src/services/ticket.service.ts
// TICKETING: the only place the web app reads or writes the Ticket, ClickUpMember and TicketPerson tables.
//
// The browser never talks to ClickUp or Telegram. It saves a SUBMITTED ticket and the
// backend does the rest (number, due date, ClickUp task, escalations), so the ClickUp
// token stays on the server. The ClickUp people list is also read from our own table,
// which the backend keeps in sync.
import { client } from "@/services/schema";
import { buildTicketInput } from "@/utils/helper/ticket";
import { planPickedChanges, type DraftPerson } from "@/utils/helper/ticketPeople";
import type {
  ClickUpMember,
  PickedPerson,
  TicketFormValues,
  TicketStatus,
  TicketSubmitter,
  TicketSummary,
} from "@/types/ticket.types";

/** Only the fields this service reads, so it does not depend on the full generated model type. */
interface TicketRow {
  id: string;
  ticketNumber?: string | null;
  title: string;
  urgency: string;
  assignees: (string | null)[];
  status: TicketStatus;
  dueAt?: string | null;
  urgencyMinutes?: number | null;
  hasUpdate?: boolean | null;
  followUpSentAt?: string | null;
  gleedTaggedAt?: string | null;
  clickupTaskUrl?: string | null;
  lastError?: string | null;
  createdAt: string;
}

const toSummary = (row: TicketRow): TicketSummary => ({
  id: row.id,
  ticketNumber: row.ticketNumber ?? null,
  title: row.title,
  urgency: row.urgency,
  assignees: row.assignees.filter((n): n is string => n !== null),
  status: row.status,
  dueAt: row.dueAt ?? null,
  urgencyMinutes: row.urgencyMinutes ?? null,
  hasUpdate: row.hasUpdate === true,
  followUpSentAt: row.followUpSentAt ?? null,
  gleedTaggedAt: row.gleedTaggedAt ?? null,
  clickupTaskUrl: row.clickupTaskUrl ?? null,
  lastError: row.lastError ?? null,
  createdAt: row.createdAt,
});

const joinErrors = (errors: readonly { message: string }[] | undefined) =>
  (errors ?? []).map((e) => e.message).join("; ");

/** Saves the ticket as SUBMITTED. The number and due date arrive a few seconds later. */
export async function createTicket(
  values: TicketFormValues,
  who: TicketSubmitter,
): Promise<TicketSummary> {
  const { data, errors } = await client.models.Ticket.create(buildTicketInput(values, who));
  if (errors?.length || !data) {
    throw new Error(joinErrors(errors) || "The task could not be saved. Please try again.");
  }
  return toSummary(data as TicketRow);
}

/** The signed-in user's own tickets, newest first (ticketsByCreatedByAndSubmittedAt index). */
export async function listMyTickets(userId: string, limit = 20): Promise<TicketSummary[]> {
  const { data, errors } = await client.models.Ticket.ticketsByCreator(
    { createdBy: userId },
    { sortDirection: "DESC", limit },
  );
  if (errors?.length) throw new Error(joinErrors(errors));
  return (data as TicketRow[]).map(toSummary);
}

/** Everyone the backend has synced from the ClickUp workspace. Empty until the first sync. */
export async function listClickUpMembers(): Promise<ClickUpMember[]> {
  const members: ClickUpMember[] = [];
  let nextToken: string | null | undefined;
  do {
    const { data, errors, nextToken: next } = await client.models.ClickUpMember.list({
      limit: 200,
      nextToken,
    });
    if (errors?.length) throw new Error(joinErrors(errors));
    for (const m of data) {
      members.push({
        id: m.id,
        name: m.name,
        email: m.email ?? null,
        avatarUrl: m.avatarUrl ?? null,
        isActive: m.isActive ?? null,
        updatedAt: m.updatedAt ?? null,
      });
    }
    nextToken = next;
  } while (nextToken);
  return members;
}

/** The reusable list: the only people the "Assign to" dropdown offers. Empty until it is set up. */
export async function listPickedPeople(): Promise<PickedPerson[]> {
  const people: PickedPerson[] = [];
  let nextToken: string | null | undefined;
  do {
    const { data, errors, nextToken: next } = await client.models.TicketPerson.list({
      limit: 200,
      nextToken,
    });
    if (errors?.length) throw new Error(joinErrors(errors));
    for (const p of data) {
      people.push({
        id: p.id,
        displayName: p.displayName,
        clickupUserId: p.clickupUserId ?? null,
        sortOrder: p.sortOrder,
      });
    }
    nextToken = next;
  } while (nextToken);
  return people;
}

/** Saves the pop-up: only the rows that actually changed are written. */
export async function savePickedPeople(
  current: readonly PickedPerson[],
  draft: readonly DraftPerson[],
): Promise<void> {
  const plan = planPickedChanges(current, draft);
  const results = await Promise.all([
    ...plan.creates.map((c) =>
      client.models.TicketPerson.create({
        displayName: c.displayName,
        clickupUserId: c.clickupUserId ?? undefined,
        sortOrder: c.sortOrder,
      }),
    ),
    ...plan.updates.map((u) =>
      client.models.TicketPerson.update({
        id: u.id,
        displayName: u.displayName,
        clickupUserId: u.clickupUserId,
        sortOrder: u.sortOrder,
      }),
    ),
    ...plan.deletes.map((id) => client.models.TicketPerson.delete({ id })),
  ]);
  const message = results.map((r) => joinErrors(r.errors)).filter(Boolean).join("; ");
  if (message) throw new Error(message);
}