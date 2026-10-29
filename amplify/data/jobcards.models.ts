// amplify/data/jobcards.models.ts
import { a } from "@aws-amplify/backend";

export const jobCardModels = {
  JobCardStatus: a.enum(["OPEN", "CLOSED"]),
  JobCardModuleType: a.enum(["INSPECTION", "ZERO_CALIBRATION", "SPAN_CALIBRATION"]),
  JobCardModuleStatus: a.enum(["PENDING", "SUBMITTED"]),
  DeliveryStatus: a.enum(["PENDING", "SENT", "FAILED"]),
  CertificateStatus: a.enum(["ISSUED", "SUPERSEDED"]),
  TimeEntryStartReason: a.enum([
    "WORK_ITEM_ADDED",
    "WORK_ITEM_STARTED",
    "RESULT_SUBMITTED",
    "JOB_CARD_OPENED",
  ]),
  TimeEntryEndReason: a.enum([
    "ALL_SUBMITTED",
    "JOB_CLOSED",
    "NO_WORK_ITEMS",
    "SESSION_ENDED",
    "IDLE_TIMEOUT",
  ]),

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

  JobCard: a
    .model({
      jcNumber: a.string().required(),
      quoteId: a.string(),
      quoteNumber: a.string(),
      customerName: a.string(),
      customerSiteId: a.id(),
      title: a.string(),
      status: a.ref("JobCardStatus").required(),
      openedAt: a.datetime(),
      closedAt: a.datetime(),
      closedBy: a.string(),
      clickupTaskId: a.string(),
      totalMinutes: a.integer(),
      assignedTo: a.string(),
      assignedToName: a.string(),
      assignedToEmail: a.string(),
      assignedAt: a.datetime(),
      // Backend markers, visible via GraphQL.
      totalTimePostedAt: a.datetime(),
      certificateSentAt: a.datetime(),
      // Sparse GSI partition key. Set to "PENDING" when the card is closed;
      // removed once both markers above are set. Only cards awaiting wrap-up
      // appear in jobCardsByWrapUpPending, so the sweep query stays at 1 RCU.
      wrapUpPending: a.string(),
      telegramGroupId: a.id(),
      telegramGroup: a.belongsTo("TelegramGroup", "telegramGroupId"),
      scales: a.hasMany("JobCardScale", "jobCardId"),
      timeEntries: a.hasMany("JobCardTimeEntry", "jobCardId"),
    })
    .secondaryIndexes((index) => [
      index("jcNumber").queryField("jobCardsByNumber"),
      index("quoteNumber").queryField("jobCardsByQuoteNumber"),
      index("status").sortKeys(["openedAt"]).queryField("jobCardsByStatus"),
      index("wrapUpPending").sortKeys(["closedAt"]).queryField("jobCardsByWrapUpPending"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  JobCardScale: a
    .model({
      jobCardId: a.id().required(),
      jobCard: a.belongsTo("JobCard", "jobCardId"),
      scaleName: a.string().required(),
      assetId: a.id(),
      monitoringScaleId: a.string(),
      createdBy: a.string(),
      modules: a.hasMany("JobCardModule", "scaleId"),
      certificates: a.hasMany("CalibrationCertificate", "scaleId"),
    })
    .secondaryIndexes((index) => [
      index("jobCardId").sortKeys(["scaleName"]).queryField("scalesByJobCard"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  JobCardModule: a
    .model({
      scaleId: a.id().required(),
      scale: a.belongsTo("JobCardScale", "scaleId"),
      jobCardId: a.id().required(),
      moduleType: a.ref("JobCardModuleType").required(),
      status: a.ref("JobCardModuleStatus").required(),
      sequence: a.integer().required(),
      addedBy: a.string(),
      addedAt: a.datetime(),
      submittedBy: a.string(),
      submittedAt: a.datetime(),
      assignedTo: a.string(),
      assignedToName: a.string(),
      submissions: a.hasMany("JobCardSubmission", "moduleId"),
    })
    .secondaryIndexes((index) => [
      index("scaleId").sortKeys(["sequence"]).queryField("modulesByScale"),
      index("jobCardId").queryField("modulesByJobCard"),
      index("assignedTo").queryField("modulesByAssignee"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  JobCardSubmission: a
    .model({
      moduleId: a.id().required(),
      module: a.belongsTo("JobCardModule", "moduleId"),
      scaleId: a.id().required(),
      jobCardId: a.id().required(),
      moduleType: a.ref("JobCardModuleType").required(),
      scaleTypeKey: a.string().required(),
      submittedBy: a.string().required(),
      submittedAt: a.datetime().required(),
      schemaVersion: a.integer().required(),
      payload: a.json().required(),
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
      index("scaleTypeKey").sortKeys(["submittedAt"]).queryField("submissionsByScaleType"),
      index("jobCardId").sortKeys(["submittedAt"]).queryField("submissionsByJobCard"),
      index("deliveryState").sortKeys(["submittedAt"]).queryField("submissionsByDeliveryState"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  JobCardTimeEntry: a
    .model({
      jobCardId: a.id().required(),
      jobCard: a.belongsTo("JobCard", "jobCardId"),
      moduleId: a.id(),
      userId: a.string().required(),
      userName: a.string(),
      userEmail: a.string(),
      startedAt: a.datetime().required(),
      lastActiveAt: a.datetime(),
      endedAt: a.datetime(),
      minutes: a.integer(),
      startReason: a.ref("TimeEntryStartReason"),
      endReason: a.ref("TimeEntryEndReason"),
    })
    .secondaryIndexes((index) => [
      index("jobCardId").sortKeys(["startedAt"]).queryField("timeEntriesByJobCard"),
      index("userId").sortKeys(["startedAt"]).queryField("timeEntriesByUser"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  CalibrationCertificate: a
    .model({
      certificateNumber: a.string().required(),
      jobCardId: a.id().required(),
      scaleId: a.id().required(),
      scale: a.belongsTo("JobCardScale", "scaleId"),
      status: a.ref("CertificateStatus").required(),
      version: a.integer().required(),
      issuedAt: a.datetime().required(),
      issuedBy: a.string(),
      sourceSubmissionIds: a.string().array(),
      dataSnapshot: a.json(),
      pdfKey: a.string().required(),
      pdfStored: a.boolean(),
    })
    .secondaryIndexes((index) => [
      index("certificateNumber").queryField("certificatesByNumber"),
      index("scaleId").sortKeys(["issuedAt"]).queryField("certificatesByScale"),
      index("jobCardId").sortKeys(["issuedAt"]).queryField("certificatesByJobCard"),
    ])
    .authorization((allow) => [allow.authenticated().to(["read"])]),

  CertificateCounter: a
    .model({
      counterKey: a.string().required(),
      lastNumber: a.integer().required(),
    })
    .secondaryIndexes((index) => [index("counterKey")])
    .authorization((allow) => [allow.authenticated().to(["read"])]),
};

// ---- payload types unchanged ----

export interface InspectionPayload {
  asFoundTotalizer: string;
  asFoundSpanCoefficient: string;
  asFoundZeroValue: string;
  asFoundSpeedCoefficient: string;
  asFoundMaxTph?: number;
  asFoundMinTph?: number;
  asFoundRunningSpeed?: number;
  partsAttached: boolean;
  weighframeClean: boolean;
  integratorPanelClean: boolean;
  weighframeMovesFreely: boolean;
  torsionRodsMoveFreely: boolean | null;
  rollersTurning: boolean;
  beltTracking: boolean;
  integratorOk: boolean;
  speedSensorOk: boolean;
  photos: { speedSensor: string; integratorPanel: string; scale: string[] };
}

export interface ZeroCalibrationPayload {
  newZeroValue: string;
  photos: { zero: string };
}

export interface SpanCalibrationPayload {
  offset: number;
  actual: number;
  indicated: number;
  photos: { offset: string; actual: string; indicated: string };
  indicatedActual: number;
  adjustmentRatio: number;
  newPotentialSpan: number;
  latestSpanUsed: number;
  latestZeroUsed: number;
  spanAdjusted: boolean;
  newSpan: string;
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