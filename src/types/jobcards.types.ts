// src/types/jobcards.types.ts  (NEW FILE)
// Job card types used by the web app. Mirrors amplify/data/jobcards.models.ts.

export type JobCardStatus = "OPEN" | "CLOSED";
export type WorkItemType = "INSPECTION" | "ZERO_CALIBRATION" | "SPAN_CALIBRATION";
export type WorkItemStatus = "PENDING" | "SUBMITTED";
export type TimeEntryStartReason = "WORK_ITEM_ADDED" | "RESULT_SUBMITTED";
export type TimeEntryEndReason = "ALL_SUBMITTED" | "JOB_CLOSED" | "NO_WORK_ITEMS";

export const WORK_ITEM_LABEL: Record<WorkItemType, string> = {
  INSPECTION: "Inspection",
  ZERO_CALIBRATION: "Zero calibration",
  SPAN_CALIBRATION: "Span calibration",
};

export interface JobCard {
  id: string;
  jcNumber: string;
  quoteNumber?: string | null;
  customerName?: string | null;
  title?: string | null;
  status: JobCardStatus;
  openedAt?: string | null;
  closedAt?: string | null;
  closedBy?: string | null;
  clickupTaskId?: string | null;
  /** Person-time: sum of all CLOSED time entries, in minutes. */
  totalMinutes?: number | null;
  /** The Telegram group results are posted to (one group per job card). */
  telegramGroupId?: string | null;
}

export interface JobCardScale {
  id: string;
  jobCardId: string;
  scaleName: string;
}

export interface WorkItem {
  id: string;
  scaleId: string;
  jobCardId: string;
  moduleType: WorkItemType;
  status: WorkItemStatus;
  sequence: number;
  addedBy?: string | null;
  addedAt?: string | null;
  submittedBy?: string | null;
  submittedAt?: string | null;
  /** The technician (system login user, Cognito sub) this work item is assigned to. */
  assignedTo?: string | null;
  assignedToName?: string | null;
}

export interface TimeEntry {
  id: string;
  jobCardId: string;
  moduleId?: string | null;
  userId: string;
  userName?: string | null;
  startedAt: string;
  endedAt?: string | null;
  minutes?: number | null;
  startReason?: TimeEntryStartReason | null;
  endReason?: TimeEntryEndReason | null;
}

/** The person engaging with a job card. `id` is the Cognito sub. */
export interface TimeUser {
  id: string;
  name: string;
}

export type DeliveryStatus = "PENDING" | "SENT" | "FAILED";

/** An immutable result saved when a work item is completed. `payload` is the module's readings, answers and photo keys. */
export interface Submission {
  id: string;
  moduleId: string;
  scaleId: string;
  jobCardId: string;
  moduleType: WorkItemType;
  submittedBy: string;
  submittedAt: string;
  payload: Record<string, unknown>;
  clickupStatus?: DeliveryStatus | null;
  telegramStatus?: DeliveryStatus | null;
}

export interface Certificate {
  id: string;
  certificateNumber: string;
  jobCardId: string;
  scaleId: string;
  status: "ISSUED" | "SUPERSEDED";
  version: number;
  issuedAt: string;
  pdfKey: string;
  /** false while the number is reserved but the PDF has not been uploaded yet. */
  pdfStored?: boolean;
}

export interface TelegramGroupRow {
  id: string;
  chatId: string;
  groupName?: string | null;
  active?: boolean | null;
}

/** A system login user who can be assigned work. */
export interface Technician {
  id: string; // Cognito sub
  name: string;
  email?: string;
}

/** Who a work item is assigned to. */
export interface Assignee {
  id: string;
  name: string;
}