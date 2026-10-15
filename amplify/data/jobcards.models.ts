// amplify/data/jobcards.models.ts  (NEW FILE)
// Job Card models for the existing Amplify Gen2 data resource.
// Usage in amplify/data/resource.ts:
//   import { jobCardModels } from "./jobcards.models";
//   const schema = a.schema({ ...jobCardModels, /* existing models */ });
// Also add "JOBCARD" to the History.entityType enum.

import { a } from "@aws-amplify/backend";

export const jobCardModels = {
  JobCardStatus: a.enum(["OPEN", "CLOSED"]),
  JobCardModuleType: a.enum(["INSPECTION", "ZERO_CALIBRATION", "SPAN_CALIBRATION"]),
  JobCardModuleStatus: a.enum(["PENDING", "SUBMITTED"]),
  DeliveryStatus: a.enum(["PENDING", "SENT", "FAILED"]),
  CertificateStatus: a.enum(["ISSUED", "SUPERSEDED"]),
  TimeEntryStartReason: a.enum(["WORK_ITEM_ADDED", "RESULT_SUBMITTED"]),
  TimeEntryEndReason: a.enum(["ALL_SUBMITTED", "JOB_CLOSED", "NO_WORK_ITEMS"]),

  // Filled by the Telegram webhook function when the bot is added to a group.
  // One group can serve many JobCards; one JobCard has exactly one group.
  TelegramGroup: a
    .model({
      chatId: a.string().required(),
      groupName: a.string(),
      active: a.boolean(),
      addedAt: a.datetime(),
      jobCards: a.hasMany("JobCard", "telegramGroupId"),
    })
    .secondaryIndexes((index) => [
      index("chatId").queryField("telegramGroupsByChatId"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  // Created automatically when Quote.quoteStatus becomes ACCEPTED.
  JobCard: a
    .model({
      jcNumber: a.string().required(), // "JC-" + Quote.quoteNumber
      quoteId: a.string(),
      quoteNumber: a.string(),
      customerName: a.string(),
      customerSiteId: a.id(), // optional link to CustomerSite
      title: a.string(),
      status: a.ref("JobCardStatus").required(),
      openedAt: a.datetime(),
      closedAt: a.datetime(),
      closedBy: a.string(),
      clickupTaskId: a.string(), // CRM-05X task (copied from Quote)
      totalMinutes: a.integer(), // person-time: sum of all CLOSED time entries, recomputed (never incremented)
      telegramGroupId: a.id(),
      telegramGroup: a.belongsTo("TelegramGroup", "telegramGroupId"),
      scales: a.hasMany("JobCardScale", "jobCardId"),
      timeEntries: a.hasMany("JobCardTimeEntry", "jobCardId"),
    })
    .secondaryIndexes((index) => [
      index("jcNumber").queryField("jobCardsByNumber"),
      index("quoteNumber").queryField("jobCardsByQuoteNumber"),
      index("status").sortKeys(["openedAt"]).queryField("jobCardsByStatus"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  JobCardScale: a
    .model({
      jobCardId: a.id().required(),
      jobCard: a.belongsTo("JobCard", "jobCardId"),
      scaleName: a.string().required(), // free text in MVP
      assetId: a.id(), // optional link to Asset
      monitoringScaleId: a.string(), // reserved for monitoring-app import
      createdBy: a.string(),
      modules: a.hasMany("JobCardModule", "scaleId"),
      certificates: a.hasMany("CalibrationCertificate", "scaleId"),
    })
    .secondaryIndexes((index) => [
      index("jobCardId").sortKeys(["scaleName"]).queryField("scalesByJobCard"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  // One row per work item on a scale. Several of the same type are allowed.
  // Assigned from the web app or the mobile app.
  JobCardModule: a
    .model({
      scaleId: a.id().required(),
      scale: a.belongsTo("JobCardScale", "scaleId"),
      jobCardId: a.id().required(), // denormalised for per-JC queries
      moduleType: a.ref("JobCardModuleType").required(),
      status: a.ref("JobCardModuleStatus").required(),
      sequence: a.integer().required(),
      addedBy: a.string(), // Cognito sub of the user who assigned the work item
      addedAt: a.datetime(),
      submittedBy: a.string(),
      submittedAt: a.datetime(), // set when status becomes SUBMITTED; ends the time entries
      assignedTo: a.string(), // Cognito sub of the technician (a system login user) the work is assigned to
      assignedToName: a.string(), // their display name, kept here so lists need no user lookup
      submissions: a.hasMany("JobCardSubmission", "moduleId"),
    })
    .secondaryIndexes((index) => [
      index("scaleId").sortKeys(["sequence"]).queryField("modulesByScale"),
      index("jobCardId").queryField("modulesByJobCard"),
      index("assignedTo").queryField("modulesByAssignee"), // a technician's own work
    ])
    .authorization((allow) => [allow.authenticated()]),

  // Immutable. The device generates the `id` (UUID) so a retried upload
  // fails the create condition instead of duplicating the record.
  JobCardSubmission: a
    .model({
      moduleId: a.id().required(),
      module: a.belongsTo("JobCardModule", "moduleId"),
      scaleId: a.id().required(),
      jobCardId: a.id().required(),
      moduleType: a.ref("JobCardModuleType").required(),
      scaleTypeKey: a.string().required(), // `${scaleId}#${moduleType}`
      submittedBy: a.string().required(), // Cognito sub
      submittedAt: a.datetime().required(),
      schemaVersion: a.integer().required(),
      payload: a.json().required(), // see payload types below
      // Delivery bookkeeping, written by the backend worker. Whoever CREATES a submission (the mobile app)
      // must set deliveryState: "PENDING": the worker finds work through that field (a sparse index), and
      // removes it once the result has been fully handled.
      deliveryState: a.string(),
      clickupStatus: a.ref("DeliveryStatus"),
      telegramStatus: a.ref("DeliveryStatus"),
      deliveryError: a.string(),
      deliveryAttempts: a.integer(),
      nextAttemptAt: a.datetime(),
      deliveredAt: a.datetime(),
    })
    .secondaryIndexes((index) => [
      index("moduleId").sortKeys(["submittedAt"]).queryField("submissionsByModule"),
      index("scaleTypeKey")
        .sortKeys(["submittedAt"])
        .queryField("submissionsByScaleType"), // "latest zero/span" lookup
      index("jobCardId").sortKeys(["submittedAt"]).queryField("submissionsByJobCard"),
      index("deliveryState").sortKeys(["submittedAt"]).queryField("submissionsByDeliveryState"),
    ])
    .authorization((allow) => [allow.authenticated()]),
  // Passive time tracking: one row per user per "session" on a JobCard.
  //  - starts when the user first engages with the job card (adds a work item,
  //    or submits a result) and they have no open entry;
  //  - ends for everyone when the LAST work item on the job card is SUBMITTED
  //    (endedAt = that submission time), or when the job card is closed.
  // The id is deterministic: `${jobCardId}#${userId}#${sessionNo}`, so two
  // devices starting at once cannot create two open entries (the second create
  // fails its condition and is ignored).
  JobCardTimeEntry: a
    .model({
      jobCardId: a.id().required(),
      jobCard: a.belongsTo("JobCard", "jobCardId"),
      moduleId: a.id(), // work item that started the entry (optional)
      userId: a.string().required(), // Cognito sub
      userName: a.string(),
      startedAt: a.datetime().required(),
      endedAt: a.datetime(), // empty while the entry is open
      minutes: a.integer(), // set when closed
      startReason: a.ref("TimeEntryStartReason"),
      endReason: a.ref("TimeEntryEndReason"),
    })
    .secondaryIndexes((index) => [
      index("jobCardId").sortKeys(["startedAt"]).queryField("timeEntriesByJobCard"),
      index("userId").sortKeys(["startedAt"]).queryField("timeEntriesByUser"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  // Issued by the backend when every Zero/Span work item on a scale is
  // SUBMITTED. Clients read only; the backend function is granted write
  // access with allow.resource(...) at schema level.
  // A correction issues a new row (version + 1) and marks the old one SUPERSEDED.
  CalibrationCertificate: a
    .model({
      certificateNumber: a.string().required(), // "CRT-" + zero-padded sequence, e.g. "CRT-000123"
      jobCardId: a.id().required(),
      scaleId: a.id().required(),
      scale: a.belongsTo("JobCardScale", "scaleId"),
      status: a.ref("CertificateStatus").required(),
      version: a.integer().required(),
      issuedAt: a.datetime().required(),
      issuedBy: a.string(),
      sourceSubmissionIds: a.string().array(), // results the PDF was built from
      dataSnapshot: a.json(), // values printed on the certificate
      pdfKey: a.string().required(), // S3 key of the stored PDF
      pdfStored: a.boolean(), // false while the number is reserved but the PDF is not uploaded yet
    })
    .secondaryIndexes((index) => [
      index("certificateNumber").queryField("certificatesByNumber"),
      index("scaleId").sortKeys(["issuedAt"]).queryField("certificatesByScale"),
      index("jobCardId").sortKeys(["issuedAt"]).queryField("certificatesByJobCard"),
    ])
    .authorization((allow) => [allow.authenticated().to(["read"])]),

  // Sequence source for certificate numbers. Incremented with an atomic
  // conditional update in the backend so two certificates never share a number.
  CertificateCounter: a
    .model({
      counterKey: a.string().required(), // "CRT" (the certificate number prefix)
      lastNumber: a.integer().required(),
    })
    .secondaryIndexes((index) => [index("counterKey")])
    .authorization((allow) => [allow.authenticated().to(["read"])]),
};

// ---------------------------------------------------------------------------
// Payload types (JobCardSubmission.payload, schemaVersion = 1).
// Photo values are S3 keys.
// ---------------------------------------------------------------------------

export interface InspectionPayload {
  asFoundTotalizer: string; // tons, digits only, max 10
  asFoundSpanCoefficient: string; // points, digits only, max 8
  asFoundZeroValue: string; // points, digits only, max 5
  asFoundSpeedCoefficient: string; // points, digits only, max 6
  asFoundMaxTph?: number; // 2 dp
  asFoundMinTph?: number; // 2 dp
  asFoundRunningSpeed?: number; // m/s, 2 dp
  partsAttached: boolean;
  weighframeClean: boolean;
  integratorPanelClean: boolean;
  weighframeMovesFreely: boolean;
  torsionRodsMoveFreely: boolean | null; // null = N/A
  rollersTurning: boolean;
  beltTracking: boolean;
  integratorOk: boolean;
  speedSensorOk: boolean;
  photos: {
    speedSensor: string;
    integratorPanel: string;
    scale: string[]; // min 5, max 15
  };
}

export interface ZeroCalibrationPayload {
  newZeroValue: string; // points, digits only, max 5
  photos: { zero: string };
}

export interface SpanCalibrationPayload {
  offset: number; // kg/m, 2 dp
  actual: number; // kg/m, 2 dp
  indicated: number; // kg/m, 2 dp
  photos: { offset: string; actual: string; indicated: string };
  // calculated (client computes, server recomputes and validates)
  indicatedActual: number;
  adjustmentRatio: number; // display as % (x100)
  newPotentialSpan: number;
  latestSpanUsed: number;
  latestZeroUsed: number;
  spanAdjusted: boolean;
  newSpan: string; // points, digits only, max 8
}

export function calcSpan(
  offset: number,
  actual: number,
  indicated: number,
  latestSpan: number,
  latestZero: number,
) {
  const indicatedActual = offset + actual;
  const adjustmentRatio = (indicatedActual - indicated) / (indicated - offset);
  const newPotentialSpan =
    (latestSpan - latestZero) * adjustmentRatio + latestZero;
  return { indicatedActual, adjustmentRatio, newPotentialSpan };
}