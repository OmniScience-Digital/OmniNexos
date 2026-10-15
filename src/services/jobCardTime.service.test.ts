// src/services/jobCardTime.service.test.ts  (NEW FILE - test)
// Runs the real service functions against an in-memory fake of the Amplify client.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({
  entries: new Map<string, Row>(),
  items: new Map<string, Row>(),
  scales: new Map<string, Row>(),
  groups: new Map<string, Row>(),
  techCalls: 0,
  techFail: false,
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
        update: async (r: Row) => {
          const row = db.items.get(r.id as string);
          if (!row) return { errors: [{ message: "not found" }] };
          Object.assign(row, r);
          return { data: row };
        },
      },
      TelegramGroup: {
        get: async ({ id }: Row) => ({ data: db.groups.get(id as string) ?? null }),
        telegramGroupsByChatId: async ({ chatId }: Row) => ({ data: [...db.groups.values()].filter((g) => g.chatId === chatId) }),
        create: async (r: Row) => {
          const row = { ...r, id: (r.id as string) ?? `g${++db.n}` };
          db.groups.set(row.id as string, row);
          return { data: row };
        },
      },
      JobCard: { update: async (r: Row) => { Object.assign(db.jc, r); return { data: db.jc }; } },
      JobCardScale: { delete: async (r: Row) => { db.scales.delete(r.id as string); return { data: r }; } },
    },
    queries: {
      techniciansList: async () => {
        db.techCalls += 1;
        if (db.techFail) { db.techFail = false; return { errors: [{ message: "boom" }] }; }
        return { data: [{ id: "u2", name: "Ben", email: "b@x.co" }, null, { id: "u1", name: "Ayanda" }] };
      },
    },
  },
}));

import {
  addTelegramGroup, addWorkItem, assignWorkItem, closeJobCard, listTechnicians, recordEngagement, removeScale, removeWorkItem,
  setTelegramGroup, syncTimeTracking,
} from "./jobCardTime.service";

const A = { id: "userA", name: "Ayanda" };
const B = { id: "userB", name: "Ben" };
const jobCard = { id: "jc1", status: "OPEN" as const };
const at = (hhmm: string) => `2026-10-12T${hhmm}:00.000Z`;
const submit = (id: string, hhmm: string) =>
  db.items.set(id, { ...db.items.get(id), status: "SUBMITTED", submittedAt: at(hhmm) });
const entries = () => [...db.entries.values()];

beforeEach(() => {
  db.entries.clear(); db.items.clear(); db.scales.clear(); db.groups.clear(); db.techCalls = 0; db.techFail = false; db.n = 0;
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

  it("assigns a technician when adding work, but the time entry stays with the person who added it", async () => {
    await addWorkItem({ jobCard, scaleId: "s1", type: "ZERO_CALIBRATION", user: A, assignee: { id: "userB", name: "Ben" } });
    expect(db.items.get("wi1")).toMatchObject({ assignedTo: "userB", assignedToName: "Ben", addedBy: "userA" });
    expect(entries().map((e) => e.userId)).toEqual(["userA"]);
  });

  it("assigns, reassigns and unassigns pending work, but never submitted work", async () => {
    await addWorkItem({ jobCard, scaleId: "s1", type: "ZERO_CALIBRATION", user: A });
    expect(db.items.get("wi1")!.assignedTo).toBeUndefined();
    await assignWorkItem({ id: "wi1", status: "PENDING" }, { id: "userB", name: "Ben" });
    expect(db.items.get("wi1")).toMatchObject({ assignedTo: "userB", assignedToName: "Ben" });
    await assignWorkItem({ id: "wi1", status: "PENDING" }, { id: "userC", name: "Cara" });
    expect(db.items.get("wi1")).toMatchObject({ assignedTo: "userC", assignedToName: "Cara" });
    await assignWorkItem({ id: "wi1", status: "PENDING" }, null);
    expect(db.items.get("wi1")).toMatchObject({ assignedTo: null, assignedToName: null });
    await expect(assignWorkItem({ id: "wi1", status: "SUBMITTED" }, { id: "userB", name: "Ben" })).rejects.toThrow(/submitted/);
  });

  it("technician list drops empty rows, is cached for 5 minutes, and a failure is not cached", async () => {
    const first = await listTechnicians(true);
    expect(first).toEqual([{ id: "u2", name: "Ben", email: "b@x.co" }, { id: "u1", name: "Ayanda", email: undefined }]);
    await listTechnicians();
    expect(db.techCalls).toBe(1); // second call served from the cache
    vi.setSystemTime(new Date(at("08:06")));
    await listTechnicians();
    expect(db.techCalls).toBe(2); // cache expired
    db.techFail = true;
    await expect(listTechnicians(true)).rejects.toThrow(/boom/);
    await expect(listTechnicians()).resolves.toHaveLength(2); // retried, not stuck on the failure
  });

  it("adds a Telegram group by hand once (row id derived from the chat id), and refuses bad input", async () => {
    const created = await addTelegramGroup({ groupName: "  Klipfontein   JC ", chatId: " -100 1234 567890" });
    expect(created.existed).toBe(false);
    expect(created.group).toMatchObject({ chatId: "-1001234567890", groupName: "Klipfontein JC", active: true, id: "tg-1001234567890" });
    const again = await addTelegramGroup({ groupName: "Other name", chatId: "-1001234567890" });
    expect(again.existed).toBe(true);
    expect(again.group.id).toBe(created.group.id);
    expect(db.groups.size).toBe(1);
    await expect(addTelegramGroup({ groupName: "X", chatId: "@mygroup" })).rejects.toThrow(/number/);
    await expect(addTelegramGroup({ groupName: " ", chatId: "-1001234567890" })).rejects.toThrow(/name/);
    expect(db.groups.size).toBe(1);
  });
});