// src/services/ticket.service.ts
// TICKETING: the only place the web app reads or writes the Ticket table.
//
// The browser never talks to ClickUp or Telegram. It saves a SUBMITTED ticket and the
// backend does the rest (number, due date, ClickUp task, escalations), so the ClickUp
// token stays on the server.
import { client } from "@/services/schema";
import { buildTicketInput } from "@/utils/helper/ticket";
import type {
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

/** The signed-in user's own tickets, newest first (ticketsByCreatedByAndCreatedAt index). */
export async function listMyTickets(userId: string, limit = 20): Promise<TicketSummary[]> {
  const { data, errors } = await client.models.Ticket.ticketsByCreator(
    { createdBy: userId },
    { sortDirection: "DESC", limit },
  );
  if (errors?.length) throw new Error(joinErrors(errors));
  return (data as TicketRow[]).map(toSummary);
}