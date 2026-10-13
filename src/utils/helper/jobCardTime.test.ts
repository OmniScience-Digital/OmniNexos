// src/utils/helper/jobCardTime.test.ts
import { describe, expect, it } from "vitest";
import {
  allSubmitted, clampEnd, closedMinutesTotal, elapsedSpan, entrySeconds, formatDuration,
  lastSubmittedAt, minutesBetween, nextSessionId, personSeconds, planStop, totalsByUser,
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