// src/types/jobcards.types.ts  
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