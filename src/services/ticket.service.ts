// src/services/ticket.service.ts
// TICKETING: the only place the web app reads or writes the Ticket and ClickUpMember tables.
//
// The browser never talks to ClickUp or Telegram. It saves a SUBMITTED ticket and the
// backend does the rest (number, due date, ClickUp task, escalations), so the ClickUp
// token stays on the server. The ClickUp people list is also read from our own table,
// which the backend keeps in sync.
import { client } from "@/services/schema";
import { buildTicketInput } from "@/utils/helper/ticket";
import type {
  ClickUpMember,
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