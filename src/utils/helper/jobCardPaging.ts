// src/utils/helper/jobCardPaging.ts 
// Cursor paging for the job card list. Pure: the database call is injected, so it is unit tested.
//
// Why cursors, not page numbers: DynamoDB only hands back "the token after this page", so the UI keeps the
// stack of tokens it has seen (that is what makes "Previous" work).
// Why a status at a time: job cards are read through the status index, so Open ones are fetched without
// touching Closed ones. For the "All" view the stream is simply Open (newest first), then Closed.
import type { JobCard, JobCardStatus } from "@/types/jobcards.types";

export type StatusFilter = JobCardStatus | "ALL";
export interface PageCursor { status: JobCardStatus; token: string | null }
export interface StatusQueryResult { items: JobCard[]; nextToken: string | null }
export type StatusQuery = (status: JobCardStatus, limit: number, nextToken: string | null) => Promise<StatusQueryResult>;

export const PAGE_SIZES = [10, 25, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;

/** Which statuses a filter reads, in display order. */
export const statusesFor = (filter: StatusFilter): JobCardStatus[] => (filter === "ALL" ? ["OPEN", "CLOSED"] : [filter]);

const MAX_ROUND_TRIPS = 20;

export async function fetchJobCardsPage(
  query: StatusQuery,
  filter: StatusFilter,
  cursor: PageCursor | null,
  limit: number,
): Promise<{ items: JobCard[]; next: PageCursor | null }> {
  const phases = statusesFor(filter);
  let idx = cursor ? Math.max(0, phases.indexOf(cursor.status)) : 0;
  let token = cursor?.token ?? null;
  const items: JobCard[] = [];

  for (let trips = 0; items.length < limit && idx < phases.length && trips < MAX_ROUND_TRIPS; trips++) {
    const res = await query(phases[idx], limit - items.length, token);
    items.push(...res.items);
    if (res.nextToken) {
      token = res.nextToken; // more rows in this status
    } else {
      idx += 1; // this status is used up: carry on with the next one (ALL only)
      token = null;
    }
  }
  return { items, next: idx < phases.length ? { status: phases[idx], token } : null };
}