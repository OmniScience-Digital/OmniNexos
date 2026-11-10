// amplify/data/ticketing.models.ts  (MODIFIED - search "CLICKUP-PEOPLE")
//
// TICKETING: the task / ticket system. Mirrors how jobcards.models.ts is wired:
// this file exports a plain object that data/resource.ts spreads into the schema.
//
// How the flow works (so the indexes below make sense):
//   1. A signed-in user submits the Task Form. The web app creates a Ticket with
//      status SUBMITTED and only the fields the user typed. It can create and read,
//      never update or delete, so nobody can tamper with a ticket after the fact.
//   2. The backend (Express + BullMQ) finds SUBMITTED tickets through the
//      `ticketsByStatusAndSubmittedAt` index, then: assigns the unique task number,
//      works out the due date, creates the ClickUp task, and flips the ticket to OPEN.
//   3. Every 5 minutes the backend reads the OPEN tickets (same index, status = OPEN),
//      forwards new ClickUp comments to Telegram, and runs the 50% / 70% escalations.
//   4. When the ClickUp task is closed the backend sets the ticket to CLOSED.
//
// Backend-only attributes that are NOT declared here on purpose (same approach as
// `lockedUntil` on JobCardSubmission): `lockedUntil` (processing lease) and
// `botCommentIds` (ClickUp comment ids the system posted itself, so they are never
// mistaken for a user update).
import { a } from "@aws-amplify/backend";

export const ticketingModels = {
  TicketStatus: a.enum([
    "SUBMITTED", // saved by the web app, waiting for the backend
    "OPEN", // ClickUp task exists, being tracked
    "CLOSED", // ClickUp task finished, no more follow-ups
    "FAILED", // backend gave up creating the ClickUp task (see lastError)
  ]),

  Ticket: a
    .model({
      // ---- typed by the user on the form --------------------------------
      title: a.string().required(),
      requiredOutcome: a.string().required(),
      urgency: a.string().required(), // "ASAP" | "1H" | "2H" | "4H" | "16H" | "27H" (validated by the backend)
      assignees: a.string().array().required(), // names picked on the form
      // ClickUp user ids of the picked people who ARE on ClickUp (taken from ClickUpMember below).
      // Optional: the backend should prefer these over name matching, and fall back to `assignees`.
      assigneeClickupIds: a.string().array(),
      mit: a.boolean(), // MIT checkbox. Not mapped to ClickUp, kept for reporting only.
      createdBy: a.string().required(), // Cognito sub of the person who submitted
      createdByName: a.string(),
      createdByEmail: a.string(),
      // Browser time of submission. Used ONLY to order the indexes below (Amplify cannot index the
      // automatic createdAt field). Due dates are worked out from the server-assigned createdAt,
      // so a wrong clock on someone's device cannot move a deadline.
      submittedAt: a.datetime().required(),

      // ---- owned by the backend -----------------------------------------
      status: a.ref("TicketStatus").required(),
      ticketNumber: a.string(), // T-0001, assigned exactly once by the backend
      urgencyMinutes: a.integer(), // urgency resolved to business minutes (ASAP = 0)
      dueAt: a.datetime(), // submission time + urgency, inside business hours
      resolvedAssignees: a.json(), // [{ name, clickupUserId, fallback }]
      clickupTaskId: a.string(),
      clickupTaskUrl: a.string(),
      hasUpdate: a.boolean(), // a person has commented on the ClickUp task
      lastCommentAt: a.datetime(), // newest ClickUp comment already handled
      followUpSentAt: a.datetime(), // 50% escalation done
      gleedTaggedAt: a.datetime(), // 70% escalation done
      closedAt: a.datetime(),
      attempts: a.integer(),
      lastError: a.string(),
    })
    .secondaryIndexes((index) => [
      // Backend queue + dashboards: SUBMITTED (intake) and OPEN (5 minute sync),
      // oldest first. This single index replaces a "sparse flag" index because the
      // partition is the status itself, and only SUBMITTED / OPEN are ever read in bulk.
      index("status").sortKeys(["submittedAt"]).queryField("ticketsByStatus"),
      // Look a ticket up by the number people quote ("T-0042").
      index("ticketNumber").queryField("ticketsByNumber"),
      // "My tickets" list under the form, newest first.
      index("createdBy").sortKeys(["submittedAt"]).queryField("ticketsByCreator"),
    ])
    // create + read only: once submitted, a ticket can only be changed by the backend
    // (which uses IAM, not these rules).
    .authorization((allow) => [allow.authenticated().to(["create", "read"])]),

  // TICKETING: everyone in the ClickUp workspace, so the Task Form can offer them (with a
  // "ClickUp user" tag) without hard-coding names or putting the ClickUp token in the browser.
  // The BACKEND fills this table (a sync job reading ClickUp's members) and uses the ClickUp
  // user id as the row id; the web app can only read it.
  // CLICKUP-PEOPLE
  ClickUpMember: a
    .model({
      name: a.string().required(),
      email: a.string(),
      avatarUrl: a.string(),
      isActive: a.boolean(), // false once the person is removed from the workspace
    })
    .authorization((allow) => [allow.authenticated().to(["read"])]),

  // Single row (id "TKT") holding the last number handed out. The backend bumps it with an
  // atomic ADD, exactly like CertificateCounter, so two tickets can never share a number.
  TicketCounter: a
    .model({
      counterKey: a.string().required(),
      lastNumber: a.integer().required(),
    })
    .secondaryIndexes((index) => [index("counterKey")])
    .authorization((allow) => [allow.authenticated().to(["read"])]),
};