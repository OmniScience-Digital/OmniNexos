// src/utils/helper/jobCardPaging.test.ts 
import { describe, expect, it } from "vitest";
import { fetchJobCardsPage, statusesFor, type StatusQuery } from "./jobCardPaging";
import type { JobCard, JobCardStatus } from "@/types/jobcards.types";

const card = (status: JobCardStatus, n: number): JobCard => ({ id: `${status}${n}`, jcNumber: `JC-${status}-${n}`, status });

/** Fake status index: `open` open rows and `closed` closed rows, served `limit` at a time with tokens. */
function fakeDb(open: number, closed: number) {
  const calls: string[] = [];
  const rows: Record<JobCardStatus, JobCard[]> = {
    OPEN: Array.from({ length: open }, (_, i) => card("OPEN", i + 1)),
    CLOSED: Array.from({ length: closed }, (_, i) => card("CLOSED", i + 1)),
  };
  const query: StatusQuery = async (status, limit, token) => {
    calls.push(status);
    const from = token ? Number(token) : 0;
    const items = rows[status].slice(from, from + limit);
    const end = from + items.length;
    return { items, nextToken: end < rows[status].length ? String(end) : null };
  };
  return { query, calls };
}
const ids = (xs: JobCard[]) => xs.map((x) => x.id);

describe("job card paging", () => {
  it("OPEN never reads closed job cards", async () => {
    const db = fakeDb(5, 50);
    const p1 = await fetchJobCardsPage(db.query, "OPEN", null, 3);
    expect(ids(p1.items)).toEqual(["OPEN1", "OPEN2", "OPEN3"]);
    const p2 = await fetchJobCardsPage(db.query, "OPEN", p1.next, 3);
    expect(ids(p2.items)).toEqual(["OPEN4", "OPEN5"]);
    expect(p2.next).toBeNull();
    expect(db.calls.every((s) => s === "OPEN")).toBe(true);
  });

  it("CLOSED reads only closed job cards", async () => {
    const db = fakeDb(5, 2);
    const p = await fetchJobCardsPage(db.query, "CLOSED", null, 10);
    expect(ids(p.items)).toEqual(["CLOSED1", "CLOSED2"]);
    expect(db.calls.every((s) => s === "CLOSED")).toBe(true);
  });

  it("ALL streams open first, then closed, and a page can span both", async () => {
    const db = fakeDb(5, 3);
    const p1 = await fetchJobCardsPage(db.query, "ALL", null, 4);
    expect(ids(p1.items)).toEqual(["OPEN1", "OPEN2", "OPEN3", "OPEN4"]);
    const p2 = await fetchJobCardsPage(db.query, "ALL", p1.next, 4);
    expect(ids(p2.items)).toEqual(["OPEN5", "CLOSED1", "CLOSED2", "CLOSED3"]);
    expect(p2.next).toBeNull();
  });

  it("empty status gives an empty page and no next cursor", async () => {
    const db = fakeDb(0, 0);
    expect(await fetchJobCardsPage(db.query, "OPEN", null, 10)).toEqual({ items: [], next: null });
  });

  it("walks the whole set exactly once with any page size, going back via saved cursors", async () => {
    const db = fakeDb(7, 4);
    const seen: string[] = [];
    const cursors = [null as Awaited<ReturnType<typeof fetchJobCardsPage>>["next"]];
    for (let i = 0; i < 10 && cursors[i] !== undefined; i++) {
      const p = await fetchJobCardsPage(db.query, "ALL", cursors[i], 3);
      seen.push(...ids(p.items));
      if (!p.next) break;
      cursors.push(p.next);
    }
    expect(seen).toEqual([...Array.from({ length: 7 }, (_, i) => `OPEN${i + 1}`), ...Array.from({ length: 4 }, (_, i) => `CLOSED${i + 1}`)]);
    // "Previous": re-fetching page 2 from its saved cursor gives the same rows
    const again = await fetchJobCardsPage(db.query, "ALL", cursors[1], 3);
    expect(ids(again.items)).toEqual(["OPEN4", "OPEN5", "OPEN6"]);
  });

  it("filters map to the statuses they read", () => {
    expect(statusesFor("OPEN")).toEqual(["OPEN"]);
    expect(statusesFor("CLOSED")).toEqual(["CLOSED"]);
    expect(statusesFor("ALL")).toEqual(["OPEN", "CLOSED"]);
  });
});