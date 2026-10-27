// src/services/jobCardTime.service.test.ts  
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
  addTelegramGroup, addWorkItem, assignJobCard, closeJobCard, endSession, listTechnicians, recordEngagement, removeScale,
  removeWorkItem, setTelegramGroup, sweepIdleSessions, syncTimeTracking, touchSession,
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

/** A technician entering the job card: the only thing that starts time. */
const enter = (user: typeof A) => recordEngagement({ jobCardId: "jc1", user, reason: "JOB_CARD_OPENED" });

describe("passive time tracking, end to end", () => {
  it("adding work starts no timer", async () => {
    await addWorkItem({ jobCard, scaleId: "s1", type: "ZERO_CALIBRATION", user: A });
    await addWorkItem({ jobCard, scaleId: "s1", type: "SPAN_CALIBRATION", user: B });
    expect(db.items.size).toBe(2);
    expect(entries()).toHaveLength(0);
  });

  it("starts when each technician enters, per user, and stops at the last submission", async () => {
    await enter(A);                                                                    // 08:00 A starts
    await addWorkItem({ jobCard, scaleId: "s1", type: "ZERO_CALIBRATION", user: A });
    vi.setSystemTime(new Date(at("08:30")));
    await enter(B);                                                                    // 08:30 B starts
    await addWorkItem({ jobCard, scaleId: "s1", type: "SPAN_CALIBRATION", user: B });
    vi.setSystemTime(new Date(at("08:45")));
    await addWorkItem({ jobCard, scaleId: "s1", type: "INSPECTION", user: A });       // adds nothing

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
      recordEngagement({ jobCardId: "jc1", user: A, reason: "JOB_CARD_OPENED" }),
      recordEngagement({ jobCardId: "jc1", user: A, reason: "JOB_CARD_OPENED" }),
    ]);
    expect(entries()).toHaveLength(1);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("entering again after completion starts a new session for that user only; adding work does not", async () => {
    await enter(A);
    await addWorkItem({ jobCard, scaleId: "s1", type: "ZERO_CALIBRATION", user: A });
    submit("wi1", "09:00");
    await syncTimeTracking("jc1", at("09:05"));
    vi.setSystemTime(new Date(at("13:00")));
    await addWorkItem({ jobCard, scaleId: "s1", type: "SPAN_CALIBRATION", user: A });
    expect(entries()).toHaveLength(1); // work added by the office at 13:00 clocks nothing
    await enter(A);
    expect(entries()).toHaveLength(2);
    expect(db.entries.get("jc1#userA#2")).toMatchObject({ startedAt: at("13:00") });
    expect(db.entries.get("jc1#userA#2")!.endedAt).toBeUndefined();
  });

  it("removing the last pending work item completes the job card", async () => {
    await enter(A);
    await addWorkItem({ jobCard, scaleId: "s1", type: "ZERO_CALIBRATION", user: A });
    await addWorkItem({ jobCard, scaleId: "s1", type: "SPAN_CALIBRATION", user: A });
    submit("wi1", "08:20");
    vi.setSystemTime(new Date(at("08:40")));
    await removeWorkItem({ id: "wi2", jobCardId: "jc1", status: "PENDING" });
    expect(db.entries.get("jc1#userA#1")).toMatchObject({ endedAt: at("08:20"), endReason: "ALL_SUBMITTED", minutes: 20 });
  });

  it("closing the job card stops everyone and refuses new work items", async () => {
    await enter(A);
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
    await enter(A);
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

  it("adding work does not assign it to anyone: assignment is per job card", async () => {
    await addWorkItem({ jobCard, scaleId: "s1", type: "ZERO_CALIBRATION", user: A });
    expect(db.items.get("wi1")!.assignedTo).toBeUndefined();
    expect(db.items.get("wi1")).toMatchObject({ addedBy: "userA" });
    expect(entries()).toHaveLength(0);
  });

  it("assigns, reassigns and unassigns the job card, and assigning does not start any time", async () => {
    const card = { id: "jc1", status: "OPEN" as const, jcNumber: "JC-QU-0032", customerName: "ESCOM", assignedTo: undefined as string | undefined };
    await assignJobCard(card, { id: "userB", name: "Ben", email: "Ben@x.co" });
    expect(db.jc).toMatchObject({ assignedTo: "userB", assignedToName: "Ben", assignedToEmail: "ben@x.co" });
    expect(db.jc.assignedAt).toBeTruthy();
    await assignJobCard({ ...card, assignedTo: "userB" }, { id: "userC", name: "Cara" });
    expect(db.jc).toMatchObject({ assignedTo: "userC", assignedToName: "Cara" });
    await assignJobCard({ ...card, assignedTo: "userC" }, null);
    expect(db.jc).toMatchObject({ assignedTo: null, assignedToName: null, assignedToEmail: null, assignedAt: null });
    expect(entries()).toHaveLength(0); // assigned days before site: no timer
  });

  it("picking the same technician again changes nothing and sends no second alert", async () => {
    const card = { id: "jc1", status: "OPEN" as const, jcNumber: "JC-1", customerName: null, assignedTo: "userB" };
    db.jc.assignedAt = "2026-10-20T07:00:00.000Z";
    expect(await assignJobCard(card, { id: "userB", name: "Ben", email: "ben@x.co" })).toBe("skipped");
    expect(db.jc.assignedAt).toBe("2026-10-20T07:00:00.000Z"); // the assigned date is not touched
  });

  it("a session that begins after the work was finished is not stopped by it", async () => {
    await addWorkItem({ jobCard, scaleId: "s1", type: "ZERO_CALIBRATION", user: A });
    await enter(A);                                   // 08:00
    submit("wi1", "09:00");
    expect(await syncTimeTracking("jc1", at("09:05"))).toBe(true);
    expect(db.entries.get("jc1#userA#1")).toMatchObject({ endedAt: at("09:00") });
    vi.setSystemTime(new Date(at("14:00")));
    await enter(B);                                   // someone opens the finished card to correct it
    expect(await syncTimeTracking("jc1", at("14:05"))).toBe(false);
    expect(db.entries.get("jc1#userB#1")!.endedAt).toBeUndefined();
  });

  it("assigning says why nobody was notified, never notifies on unassign or re-pick, and refuses a closed card", async () => {
    const card = { id: "jc1", status: "OPEN" as const, jcNumber: "JC-1", customerName: null, assignedTo: undefined as string | undefined };
    expect(await assignJobCard(card, { id: "userB", name: "Ben" })).toBe("no-email");
    expect(await assignJobCard({ ...card, assignedTo: "userB" }, { id: "userB", name: "Ben" })).toBe("skipped");
    expect(await assignJobCard(card, null)).toBe("skipped");
    await expect(assignJobCard({ ...card, status: "CLOSED" as never }, { id: "userB", name: "Ben" })).rejects.toThrow(/closed/);
  });

  it("one person with a manual and a social login has one running session, not two", async () => {
    const manual = { id: "sub-manual", name: "Ayanda", email: "Ayanda@x.co" };
    const social = { id: "Google_123", name: "Ayanda", email: "ayanda@x.co" };
    expect(await recordEngagement({ jobCardId: "jc1", user: manual, reason: "JOB_CARD_OPENED" })).not.toBeNull();
    expect(await recordEngagement({ jobCardId: "jc1", user: social, reason: "RESULT_SUBMITTED" })).toBeNull();
    expect(entries()).toHaveLength(1);
    expect(entries()[0]).toMatchObject({ userEmail: "ayanda@x.co" }); // stored lower-case
  });

  it("a web session starts with a heartbeat, ends when the person leaves, and is idempotent", async () => {
    const e = (await recordEngagement({ jobCardId: "jc1", user: A, reason: "JOB_CARD_OPENED" }))!;
    expect(db.entries.get(e.id)).toMatchObject({ startReason: "JOB_CARD_OPENED", lastActiveAt: at("08:00") });
    vi.setSystemTime(new Date(at("08:02")));
    await touchSession(e.id);
    expect(db.entries.get(e.id)!.lastActiveAt).toBe(at("08:02"));
    vi.setSystemTime(new Date(at("08:40")));
    expect(await endSession({ id: e.id, jobCardId: "jc1", startedAt: e.startedAt })).toBe(true);
    expect(db.entries.get(e.id)).toMatchObject({ endedAt: at("08:40"), minutes: 40, endReason: "SESSION_ENDED" });
    expect(db.jc.totalMinutes).toBe(40);
    expect(await endSession({ id: e.id, jobCardId: "jc1", startedAt: e.startedAt, endedAt: at("08:40") })).toBe(false);
  });

  it("visits on different days are separate sessions that add up", async () => {
    const day1 = (await recordEngagement({ jobCardId: "jc1", user: A, reason: "JOB_CARD_OPENED", at: "2026-10-12T08:00:00.000Z" }))!;
    await endSession({ id: day1.id, jobCardId: "jc1", startedAt: day1.startedAt }, "SESSION_ENDED", "2026-10-12T10:00:00.000Z");
    const day2 = (await recordEngagement({ jobCardId: "jc1", user: A, reason: "JOB_CARD_OPENED", at: "2026-10-14T09:00:00.000Z" }))!;
    await endSession({ id: day2.id, jobCardId: "jc1", startedAt: day2.startedAt }, "SESSION_ENDED", "2026-10-14T09:30:00.000Z");
    expect(entries().map((x) => x.id)).toEqual(["jc1#userA#1", "jc1#userA#2"]);
    expect(db.jc.totalMinutes).toBe(150);
  });

  it("an abandoned web session is closed at its last heartbeat, and mobile entries are left alone", async () => {
    const web = (await recordEngagement({ jobCardId: "jc1", user: A, reason: "JOB_CARD_OPENED" }))!;
    await recordEngagement({ jobCardId: "jc1", user: B, reason: "RESULT_SUBMITTED" }); // mobile-style: no heartbeat
    vi.setSystemTime(new Date(at("08:03")));
    await touchSession(web.id);
    vi.setSystemTime(new Date(at("08:06")));
    expect(await sweepIdleSessions("jc1", Date.now())).toBe(0); // 3 min quiet: still alive
    vi.setSystemTime(new Date(at("09:00")));
    expect(await sweepIdleSessions("jc1", Date.now())).toBe(1);
    expect(db.entries.get(web.id)).toMatchObject({ endedAt: at("08:03"), minutes: 3, endReason: "IDLE_TIMEOUT" });
    expect(db.entries.get("jc1#userB#1")!.endedAt).toBeUndefined();
    expect(await sweepIdleSessions("jc1", Date.now())).toBe(0); // idempotent
  });

  it("a corrected result after completion moves the stop time forward", async () => {
    await enter(A);
    await addWorkItem({ jobCard, scaleId: "s1", type: "ZERO_CALIBRATION", user: A });
    submit("wi1", "09:00");
    expect(await syncTimeTracking("jc1", at("23:00"))).toBe(true);
    expect(db.entries.get("jc1#userA#1")).toMatchObject({ endedAt: at("09:00"), minutes: 60 });
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