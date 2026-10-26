// src/utils/helper/jobCardTime.test.ts
import { describe, expect, it } from "vitest";
import {
  allSubmitted, clampEnd, closedMinutesTotal, elapsedSpan, entrySeconds, formatDuration,
  emailLookup, groupSessionsByDay, isSamePerson, lastSubmittedAt, minutesBetween, nextSessionId, personKey,
  personSeconds, planIdleStops, planStop, shouldStartSession, siteDay, totalsByUser,
} from "./jobCardTime";
import type { TimeEntry, WorkItem } from "@/types/jobcards.types";

const t = (hhmm: string) => `2026-10-12T${hhmm}:00.000Z`;
const item = (status: WorkItem["status"], submittedAt?: string): WorkItem => ({
  id: Math.random().toString(), scaleId: "s", jobCardId: "jc", moduleType: "ZERO_CALIBRATION",
  status, sequence: 1, submittedAt,
});
const entry = (userId: string, start: string, end?: string, minutes?: number): TimeEntry => ({
  id: `${userId}${start}`, jobCardId: "jc", userId, userName: userId, startedAt: t(start),
  endedAt: end ? t(end) : undefined, minutes,
});

describe("stop rule", () => {
  it("does not stop while any work item is pending", () => {
    const plan = planStop([item("SUBMITTED", t("10:00")), item("PENDING")], [entry("a", "08:00")], t("11:00"));
    expect(plan).toBeNull();
  });
  it("stops at the LAST submission time, not at 'now'", () => {
    const plan = planStop(
      [item("SUBMITTED", t("09:30")), item("SUBMITTED", t("10:15"))],
      [entry("a", "08:00")],
      t("23:00"),
    );
    expect(plan).toEqual({ stopAt: t("10:15"), reason: "ALL_SUBMITTED" });
  });
  it("does nothing when no entry is open", () => {
    expect(planStop([item("SUBMITTED", t("10:00"))], [entry("a", "08:00", "10:00", 120)], t("11:00"))).toBeNull();
  });
  it("stops when every work item has been removed", () => {
    expect(planStop([], [entry("a", "08:00")], t("09:00"))).toEqual({ stopAt: t("09:00"), reason: "NO_WORK_ITEMS" });
  });
  it("allSubmitted needs at least one item", () => {
    expect(allSubmitted([])).toBe(false);
    expect(allSubmitted([item("SUBMITTED")])).toBe(true);
  });
  it("finds the latest submission", () => {
    expect(lastSubmittedAt([item("SUBMITTED", t("09:00")), item("SUBMITTED", t("10:00")), item("PENDING")])).toBe(t("10:00"));
  });
  it("never ends an entry before it started", () => {
    expect(clampEnd(t("10:00"), t("09:00"))).toBe(t("10:00"));
  });
});

describe("per user per job card", () => {
  it("session ids are per user and sequential", () => {
    const es = [entry("a", "08:00", "09:00", 60), entry("b", "08:30")];
    expect(nextSessionId("jc", "a", es)).toBe("jc#a#2");
    expect(nextSessionId("jc", "b", es)).toBe("jc#b#2");
    expect(nextSessionId("jc", "c", es)).toBe("jc#c#1");
  });
  it("totals each user separately and sums person-time", () => {
    const now = Date.parse(t("12:00"));
    const es = [entry("a", "08:00", "10:00", 120), entry("b", "09:00", "10:00", 60), entry("a", "11:00")];
    const by = totalsByUser(es, now);
    expect(by.find((u) => u.userId === "a")).toMatchObject({ seconds: 3 * 3600, sessions: 2, running: true });
    expect(by.find((u) => u.userId === "b")).toMatchObject({ seconds: 3600, sessions: 1, running: false });
    expect(personSeconds(es, now)).toBe(4 * 3600);
  });
  it("elapsed runs first start to last stop, or to now while open", () => {
    const now = Date.parse(t("12:00"));
    expect(elapsedSpan([entry("a", "08:00", "10:00"), entry("b", "09:00", "11:00")], now)?.seconds).toBe(3 * 3600);
    expect(elapsedSpan([entry("a", "08:00", "10:00"), entry("b", "09:00")], now)).toMatchObject({ endedAt: null, seconds: 4 * 3600 });
    expect(elapsedSpan([], now)).toBeNull();
  });
  it("stored total counts closed entries only", () => {
    expect(closedMinutesTotal([entry("a", "08:00", "10:00", 120), entry("b", "09:00")])).toBe(120);
  });
});

describe("durations", () => {
  it("rounds minutes", () => {
    expect(minutesBetween(t("08:00"), t("08:00"))).toBe(0);
    expect(minutesBetween(t("08:00"), t("10:05"))).toBe(125);
    expect(minutesBetween(t("10:00"), t("08:00"))).toBe(0);
  });
  it("entrySeconds uses now while open", () => {
    expect(entrySeconds({ startedAt: t("08:00"), endedAt: null }, Date.parse(t("08:10")))).toBe(600);
  });
  it("formats", () => {
    expect(formatDuration(0)).toBe("0 min");
    expect(formatDuration(30)).toBe("< 1 min");
    expect(formatDuration(45 * 60)).toBe("45 min");
    expect(formatDuration(125 * 60)).toBe("2 h 05 min");
  });
});

describe("one person, two logins", () => {
  const manual = { ...entry("sub-1", "08:00", "10:00", 120), userEmail: "Ayanda@x.co" };
  const social = { ...entry("Google_9", "11:00", "12:00", 60), userEmail: "ayanda@x.co" };
  const legacy = entry("sub-1", "13:00", "14:00", 60); // older row: no email, but the same id as `manual`

  it("groups by email regardless of case, and falls back to the id", () => {
    expect(personKey(manual)).toBe(personKey(social));
    expect(personKey(entry("x", "08:00"))).toBe("id:x");
  });
  it("adds both logins together as one person", () => {
    const by = totalsByUser([manual, social], Date.parse(t("23:00")));
    expect(by).toHaveLength(1);
    expect(by[0]).toMatchObject({ seconds: 3 * 3600, sessions: 2 });
  });
  it("an old row without an email joins its person through another row with the same id", () => {
    const by = totalsByUser([manual, legacy], Date.parse(t("23:00")));
    expect(by).toHaveLength(1);
    expect(by[0].seconds).toBe(3 * 3600);
  });
  it("the user list can supply emails for ids that never stored one", () => {
    const by = totalsByUser([social, legacy], Date.parse(t("23:00")), [["sub-1", "ayanda@x.co"]]);
    expect(by).toHaveLength(1);
  });
  it("matches the owner of an entry by email or id", () => {
    const es = emailLookup([manual]);
    expect(isSamePerson(manual, { id: "Google_9", email: "ayanda@x.co" }, es)).toBe(true);
    expect(isSamePerson(manual, { id: "other", email: "ben@x.co" }, es)).toBe(false);
    expect(isSamePerson(legacy, { id: "sub-1" }, es)).toBe(true); // via the id's known email
  });
});

describe("starting a session on entering a job card", () => {
  const me = { id: "a", email: "a@x.co" };
  const pending = [item("PENDING")];
  it("starts on an open job card with work still to do", () => {
    expect(shouldStartSession({ status: "OPEN", items: pending, entries: [], user: me })).toBe(true);
    expect(shouldStartSession({ status: "OPEN", items: [], entries: [], user: me })).toBe(true); // no work added yet
  });
  it("does not start on a closed job card", () => {
    expect(shouldStartSession({ status: "CLOSED", items: pending, entries: [], user: me })).toBe(false);
  });
  it("does not start when all work is already submitted (it would end before it began)", () => {
    expect(shouldStartSession({ status: "OPEN", items: [item("SUBMITTED", t("10:00"))], entries: [], user: me })).toBe(false);
  });
  it("does not start a second one for the same person, but does for someone else", () => {
    expect(shouldStartSession({ status: "OPEN", items: pending, entries: [entry("a", "08:00")], user: me })).toBe(false);
    expect(shouldStartSession({ status: "OPEN", items: pending, entries: [entry("a", "08:00")], user: { id: "b" } })).toBe(true);
    expect(shouldStartSession({ status: "OPEN", items: pending, entries: [entry("a", "08:00", "09:00", 60)], user: me })).toBe(true);
  });
});

describe("idle web sessions", () => {
  const web = (id: string, start: string, last?: string, over: Partial<TimeEntry> = {}): TimeEntry => ({
    ...entry(id, start), startReason: "JOB_CARD_OPENED", lastActiveAt: last ? t(last) : undefined, ...over,
  });
  const now = Date.parse(t("12:00"));
  it("ends a quiet session at its LAST heartbeat, not now", () => {
    expect(planIdleStops([web("a", "08:00", "08:41")], now)).toEqual([{ entryId: "a08:00", endedAt: t("08:41") }]);
  });
  it("leaves a session with a recent heartbeat", () => {
    expect(planIdleStops([web("a", "08:00", "11:58")], now)).toEqual([]);
  });
  it("uses the start time when there was never a heartbeat", () => {
    expect(planIdleStops([web("a", "08:00")], now)).toEqual([{ entryId: "a08:00", endedAt: t("08:00") }]);
  });
  it("ignores mobile entries (no JOB_CARD_OPENED) and entries that already ended", () => {
    expect(planIdleStops([entry("m", "08:00"), web("a", "08:00", "08:30", { endedAt: t("08:30") })], now)).toEqual([]);
  });
});

describe("sessions by site day", () => {
  it("groups by the site-day (SAST) a session started on, newest day first", () => {
    const e1 = { ...entry("a", "08:00", "10:00", 120), startedAt: "2026-10-12T08:00:00.000Z", endedAt: "2026-10-12T10:00:00.000Z" };
    const e2 = { ...entry("b", "09:00", "10:00", 60), startedAt: "2026-10-12T09:00:00.000Z", endedAt: "2026-10-12T10:00:00.000Z" };
    const e3 = { ...entry("a", "08:00", "08:30", 30), startedAt: "2026-10-14T08:00:00.000Z", endedAt: "2026-10-14T08:30:00.000Z" };
    const days = groupSessionsByDay([e1, e2, e3], Date.parse(t("23:00")));
    expect(days.map((d) => d.day)).toEqual(["2026-10-14", "2026-10-12"]);
    expect(days[1]).toMatchObject({ seconds: 3 * 3600, people: 2 });
    expect(days[1].sessions[0].userId).toBe("b"); // newest first
  });
  it("a session just after midnight UTC is still the same site day in South Africa", () => {
    expect(siteDay("2026-10-12T22:30:00.000Z")).toBe("2026-10-13"); // 00:30 SAST next day
    expect(siteDay("2026-10-12T21:30:00.000Z")).toBe("2026-10-12");
  });
});

describe("stop time after a corrected result", () => {
  it("uses the newest result when it is later than every work item's submit time", () => {
    const items = [item("SUBMITTED", t("09:30"))];
    expect(planStop(items, [entry("a", "08:00")], t("23:00"), t("10:15"))).toEqual({ stopAt: t("10:15"), reason: "ALL_SUBMITTED" });
    expect(planStop(items, [entry("a", "08:00")], t("23:00"), t("09:00"))).toEqual({ stopAt: t("09:30"), reason: "ALL_SUBMITTED" });
    expect(planStop(items, [entry("a", "08:00")], t("23:00"), null)).toEqual({ stopAt: t("09:30"), reason: "ALL_SUBMITTED" });
  });
});