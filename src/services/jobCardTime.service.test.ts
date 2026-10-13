// src/services/jobCardTime.service.test.ts  (NEW FILE - test)
// Runs the real service functions against an in-memory fake of the Amplify client.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({
  entries: new Map<string, Row>(),
  items: new Map<string, Row>(),
  scales: new Map<string, Row>(),
  jc: { id: "jc1", status: "OPEN", totalMinutes: 0 } as Row,
  n: 0,
}));

vi.mock("@/services/schema", () => ({
  client: {
    models: {
      JobCardTimeEntry: {
        timeEntriesByJobCard: async () => ({ data: [...db.entries.values()].map((r) => ({ ...r })) }),
        create: async (r: Row) => {
          if (db.entries.has(r.id as string)) return { errors: [{ message: "ConditionalCheckFailedException" }] };
          db.entries.set(r.id as string, { ...r });
          return { data: { ...r } };
        },
        update: async (r: Row) => {
          const next = { ...db.entries.get(r.id as string), ...r };
          db.entries.set(r.id as string, next);
          return { data: next };
        },
      },
      JobCardModule: {
        modulesByJobCard: async () => ({ data: [...db.items.values()].map((r) => ({ ...r })) }),
        create: async (r: Row) => {
          const row = { ...r, id: `wi${++db.n}` };
          db.items.set(row.id, row);
          return { data: row };
        },
        delete: async (r: Row) => { db.items.delete(r.id as string); return { data: r }; },
      },
      JobCard: { update: async (r: Row) => { Object.assign(db.jc, r); return { data: db.jc }; } },
      JobCardScale: { delete: async (r: Row) => { db.scales.delete(r.id as string); return { data: r }; } },
    },
  },
}));

import {
  addWorkItem, closeJobCard, recordEngagement, removeScale, removeWorkItem, setTelegramGroup, syncTimeTracking,
} from "./jobCardTime.service";

const A = { id: "userA", name: "Ayanda" };
const B = { id: "userB", name: "Ben" };
const jobCard = { id: "jc1", status: "OPEN" as const };
const at = (hhmm: string) => `2026-10-12T${hhmm}:00.000Z`;
const submit = (id: string, hhmm: string) =>
  db.items.set(id, { ...db.items.get(id), status: "SUBMITTED", submittedAt: at(hhmm) });
const entries = () => [...db.entries.values()];

beforeEach(() => {
  db.entries.clear(); db.items.clear(); db.scales.clear(); db.n = 0;
  db.jc = { id: "jc1", status: "OPEN", totalMinutes: 0 };
  vi.useFakeTimers();
  vi.setSystemTime(new Date(at("08:00")));
});
afterEach(() => vi.useRealTimers());

describe("passive time tracking, end to end", () => {
  it("starts on the first work item, per user, and stops at the last submission", async () => {
    await addWorkItem({ jobCard, scaleId: "s1", type: "ZERO_CALIBRATION", user: A }); // 08:00 A starts
    vi.setSystemTime(new Date(at("08:30")));
    await addWorkItem({ jobCard, scaleId: "s1", type: "SPAN_CALIBRATION", user: B }); // 08:30 B starts
    vi.setSystemTime(new Date(at("08:45")));
    await addWorkItem({ jobCard, scaleId: "s1", type: "INSPECTION", user: A });       // A already running

    expect(entries()).toHaveLength(2);
    expect(entries().map((e) => e.userId).sort()).toEqual(["userA", "userB"]);
    expect(entries().every((e) => !e.endedAt)).toBe(true);

    submit("wi1", "09:00"); submit("wi2", "09:30");
    expect(await syncTimeTracking("jc1", at("23:00"))).toBe(false); // wi3 still pending
    expect(entries().every((e) => !e.endedAt)).toBe(true);

    submit("wi3", "10:00");
    expect(await syncTimeTracking("jc1", at("23:00"))).toBe(true);

    const a = db.entries.get("jc1#userA#1")!;
    const b = db.entries.get("jc1#userB#1")!;
    expect(a).toMatchObject({ endedAt: at("10:00"), minutes: 120, endReason: "ALL_SUBMITTED" });
    expect(b).toMatchObject({ endedAt: at("10:00"), minutes: 90, endReason: "ALL_SUBMITTED" });
    expect(db.jc.totalMinutes).toBe(210); // person time
    expect(await syncTimeTracking("jc1", at("23:30"))).toBe(false); // idempotent
  });

  it("two devices starting at once create only one open entry", async () => {
    const results = await Promise.all([
      recordEngagement({ jobCardId: "jc1", user: A, reason: "WORK_ITEM_ADDED" }),
      recordEngagement({ jobCardId: "jc1", user: A, reason: "WORK_ITEM_ADDED" }),
    ]);
    expect(entries()).toHaveLength(1);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("adding a work item after completion starts a new session for that user only", async () => {
    await addWorkItem({ jobCard, scaleId: "s1", type: "ZERO_CALIBRATION", user: A });
    submit("wi1", "09:00");
    await syncTimeTracking("jc1", at("09:05"));
    vi.setSystemTime(new Date(at("13:00")));
    await addWorkItem({ jobCard, scaleId: "s1", type: "SPAN_CALIBRATION", user: A });
    expect(entries()).toHaveLength(2);
    expect(db.entries.get("jc1#userA#2")).toMatchObject({ startedAt: at("13:00") });
    expect(db.entries.get("jc1#userA#2")!.endedAt).toBeUndefined();
  });

  it("removing the last pending work item completes the job card", async () => {
    await addWorkItem({ jobCard, scaleId: "s1", type: "ZERO_CALIBRATION", user: A });
    await addWorkItem({ jobCard, scaleId: "s1", type: "SPAN_CALIBRATION", user: A });
    submit("wi1", "08:20");
    vi.setSystemTime(new Date(at("08:40")));
    await removeWorkItem({ id: "wi2", jobCardId: "jc1", status: "PENDING" });
    expect(db.entries.get("jc1#userA#1")).toMatchObject({ endedAt: at("08:20"), endReason: "ALL_SUBMITTED", minutes: 20 });
  });

  it("closing the job card stops everyone and refuses new work items", async () => {
    await addWorkItem({ jobCard, scaleId: "s1", type: "ZERO_CALIBRATION", user: A });
    vi.setSystemTime(new Date(at("08:50")));
    await closeJobCard("jc1", A);
    expect(db.entries.get("jc1#userA#1")).toMatchObject({ endedAt: at("08:50"), endReason: "JOB_CLOSED", minutes: 50 });
    expect(db.jc).toMatchObject({ status: "CLOSED", totalMinutes: 50 });
    await expect(addWorkItem({ jobCard: { id: "jc1", status: "CLOSED" }, scaleId: "s1", type: "INSPECTION", user: A }))
      .rejects.toThrow(/closed/i);
  });

  it("removing a scale deletes its pending work items and stops time if that completes the job", async () => {
    db.scales.set("s1", { id: "s1" }); db.scales.set("s2", { id: "s2" });
    await addWorkItem({ jobCard, scaleId: "s1", type: "ZERO_CALIBRATION", user: A }); // wi1 (s1)
    await addWorkItem({ jobCard, scaleId: "s2", type: "SPAN_CALIBRATION", user: A }); // wi2 (s2)
    submit("wi1", "08:20");
    vi.setSystemTime(new Date(at("08:40")));
    await removeScale({ id: "s2", jobCardId: "jc1" });
    expect(db.scales.has("s2")).toBe(false);
    expect(db.items.has("wi2")).toBe(false);
    expect(db.entries.get("jc1#userA#1")).toMatchObject({ endedAt: at("08:20"), endReason: "ALL_SUBMITTED" });
  });

  it("a scale with submitted results cannot be removed", async () => {
    db.scales.set("s1", { id: "s1" });
    await addWorkItem({ jobCard, scaleId: "s1", type: "ZERO_CALIBRATION", user: A });
    await addWorkItem({ jobCard, scaleId: "s1", type: "SPAN_CALIBRATION", user: A });
    submit("wi1", "08:20");
    await expect(removeScale({ id: "s1", jobCardId: "jc1" })).rejects.toThrow(/submitted results/);
    expect(db.scales.has("s1")).toBe(true);
    expect(db.items.size).toBe(2);
  });

  it("links and unlinks the Telegram group", async () => {
    await setTelegramGroup("jc1", "grp9");
    expect(db.jc.telegramGroupId).toBe("grp9");
    await setTelegramGroup("jc1", null);
    expect(db.jc.telegramGroupId).toBeNull();
  });
});