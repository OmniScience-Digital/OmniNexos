// src/utils/helper/ticket.test.ts
import { describe, expect, it } from "vitest";
import {
  OUTCOME_MAX,
  TITLE_MAX,
  buildPeople,
  buildTicketInput,
  businessMinutesBetween,
  emptyTicketForm,
  estimateDue,
  formatDue,
  initials,
  isOverdue,
  latestSync,
  ticketProgress,
  ticketStatus,
  validateTicketForm,
} from "./ticket";
import { SHEET_PEOPLE, type ClickUpMember, type TicketFormValues, type TicketSummary } from "@/types/ticket.types";

const valid = (over: Partial<TicketFormValues> = {}): TicketFormValues => ({
  title: "Fix the pump",
  requiredOutcome: "Pump running and tested",
  urgency: "4H",
  assignees: ["Shaughn"],
  mit: false,
  ...over,
});

describe("validateTicketForm", () => {
  it("accepts a complete form", () => {
    expect(validateTicketForm(valid())).toEqual({});
  });

  it("flags every empty required field on a blank form", () => {
    const errors = validateTicketForm(emptyTicketForm());
    expect(Object.keys(errors).sort()).toEqual(["assignees", "requiredOutcome", "title", "urgency"]);
  });

  it("treats whitespace-only text as empty", () => {
    const errors = validateTicketForm(valid({ title: "   ", requiredOutcome: "\n\t" }));
    expect(errors.title).toBeDefined();
    expect(errors.requiredOutcome).toBeDefined();
  });

  it("enforces length limits", () => {
    expect(validateTicketForm(valid({ title: "x".repeat(TITLE_MAX + 1) })).title).toBeDefined();
    expect(validateTicketForm(valid({ title: "x".repeat(TITLE_MAX) })).title).toBeUndefined();
    expect(validateTicketForm(valid({ requiredOutcome: "x".repeat(OUTCOME_MAX + 1) })).requiredOutcome).toBeDefined();
  });

  it("only allows the urgencies on the spreadsheet", () => {
    for (const u of ["ASAP", "1H", "2H", "4H", "16H", "27H"] as const) {
      expect(validateTicketForm(valid({ urgency: u })).urgency).toBeUndefined();
    }
    expect(validateTicketForm(valid({ urgency: "48H" as never })).urgency).toBeDefined();
  });

  it("needs at least one assignee, and one that is on the list when a list is given", () => {
    expect(validateTicketForm(valid({ assignees: [] })).assignees).toBeDefined();
    expect(validateTicketForm(valid({ assignees: ["Nobody"] }), SHEET_PEOPLE).assignees).toBeDefined();
    expect(validateTicketForm(valid({ assignees: ["Marco", "Byron"] }), SHEET_PEOPLE).assignees).toBeUndefined();
    expect(validateTicketForm(valid({ assignees: ["Karin Dean"] }), ["Karin Dean"]).assignees).toBeUndefined();
  });
});

describe("buildTicketInput", () => {
  it("trims text, de-duplicates assignees and starts the ticket as SUBMITTED", () => {
    const input = buildTicketInput(
      valid({ title: "  Fix the pump  ", requiredOutcome: " Done ", assignees: ["Marco", "Marco", "Byron"], mit: true }),
      { id: "user-1", name: "Gleed", email: "g@example.com" },
      new Date("2026-11-09T08:00:00.000Z"),
    );
    expect(input).toEqual({
      title: "Fix the pump",
      requiredOutcome: "Done",
      urgency: "4H",
      assignees: ["Marco", "Byron"],
      mit: true,
      status: "SUBMITTED",
      createdBy: "user-1",
      createdByName: "Gleed",
      createdByEmail: "g@example.com",
      submittedAt: "2026-11-09T08:00:00.000Z",
    });
  });

  it("includes the ClickUp ids only when there are some, without duplicates", () => {
    const withIds = buildTicketInput(valid({ assigneeClickupIds: ["1", "1", "2"] }), { id: "u" });
    expect(withIds.assigneeClickupIds).toEqual(["1", "2"]);
    expect("assigneeClickupIds" in buildTicketInput(valid(), { id: "u" })).toBe(false);
  });

  it("never includes server-owned fields", () => {
    const input = buildTicketInput(valid(), { id: "u" }) as Record<string, unknown>;
    for (const key of ["ticketNumber", "dueAt", "clickupTaskId", "urgencyMinutes"]) {
      expect(key in input).toBe(false);
    }
  });
});

describe("formatDue", () => {
  it("shows Johannesburg time", () => {
    // 11:00 UTC is 13:00 in Johannesburg (UTC+2, no daylight saving)
    expect(formatDue("2026-11-10T11:00:00.000Z")).toBe("Tue 10 Nov, 13:00");
  });

  it("shows a dash when there is no date or it is invalid", () => {
    expect(formatDue(null)).toBe("-");
    expect(formatDue(undefined)).toBe("-");
    expect(formatDue("not a date")).toBe("-");
  });
});

describe("initials", () => {
  it("uses first and last word", () => {
    expect(initials("Marco Rougier")).toBe("MR");
    expect(initials("Gert Jansen van Rensburg")).toBe("GR");
    expect(initials("Gleed")).toBe("G");
    expect(initials("  ")).toBe("?");
  });
});

const member = (id: string, name: string, over: Partial<ClickUpMember> = {}): ClickUpMember => ({ id, name, ...over });

describe("buildPeople", () => {
  it("lists every standard name even with no ClickUp members, none tagged", () => {
    const people = buildPeople([]);
    expect(people.map((p) => p.value).sort()).toEqual([...SHEET_PEOPLE].sort());
    expect(people.every((p) => p.clickupUserId === null)).toBe(true);
  });

  it("shows a matching person once, as the ClickUp user, keeping the standard name as the value", () => {
    const people = buildPeople([member("10", "Marco Rougier")]);
    const marco = people.filter((p) => p.label.includes("Marco"));
    expect(marco).toHaveLength(1);
    expect(marco[0]).toMatchObject({ label: "Marco Rougier", value: "Marco", clickupUserId: "10" });
  });

  it("adds ClickUp people who are not on the standard list, using their full name", () => {
    const karin = buildPeople([member("11", "Karin Dean")]).find((p) => p.clickupUserId === "11");
    expect(karin).toMatchObject({ label: "Karin Dean", value: "Karin Dean" });
  });

  it("leaves people who are not on ClickUp untagged", () => {
    const willie = buildPeople([member("10", "Marco Rougier")]).find((p) => p.value === "Willie");
    expect(willie?.clickupUserId).toBeNull();
  });

  it("does not guess when two members share a first name", () => {
    const people = buildPeople([member("1", "Marco Rougier"), member("2", "Marco Smith")]);
    expect(people.filter((p) => p.clickupUserId).map((p) => p.value).sort()).toEqual(["Marco Rougier", "Marco Smith"]);
    expect(people.find((p) => p.value === "Marco")?.clickupUserId).toBeNull();
  });

  it("honours an alias when the spellings differ", () => {
    const people = buildPeople([member("5", "Itumeleng Tshepe")], SHEET_PEOPLE, { Tshepo: ["Itumeleng Tshepe"] });
    expect(people.find((p) => p.clickupUserId === "5")?.value).toBe("Tshepo");
    expect(people.filter((p) => p.value === "Tshepo")).toHaveLength(1);
  });

  it("ignores inactive members", () => {
    const people = buildPeople([member("10", "Marco Rougier", { isActive: false })]);
    expect(people.some((p) => p.clickupUserId === "10")).toBe(false);
    expect(people.find((p) => p.value === "Marco")?.clickupUserId).toBeNull();
  });

  it("is sorted by name", () => {
    const labels = buildPeople([member("1", "Zed Last"), member("2", "Abe First")]).map((p) => p.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });
});

describe("latestSync", () => {
  it("returns the newest updatedAt, or null", () => {
    expect(latestSync([])).toBeNull();
    const d = latestSync([
      member("1", "A", { updatedAt: "2026-11-09T08:00:00.000Z" }),
      member("2", "B", { updatedAt: "2026-11-09T09:30:00.000Z" }),
    ]);
    expect(d?.toISOString()).toBe("2026-11-09T09:30:00.000Z");
  });
});

// Monday 9 Nov 2026, 08:15 in Johannesburg (UTC+2) = 06:15 UTC. Business hours 06:00 to 17:00.
const MON_0815 = new Date("2026-11-09T06:15:00.000Z");

describe("estimateDue", () => {
  it("adds business hours from now", () => {
    expect(formatDue(estimateDue("1H", MON_0815))).toBe("Mon 9 Nov, 09:15");
    expect(formatDue(estimateDue("4H", MON_0815))).toBe("Mon 9 Nov, 12:15");
  });

  it("rolls over to the next day after 17:00 (the 16 hour example from the meeting)", () => {
    // 8h45 left today, 7h15 more from 06:00 tomorrow
    expect(formatDue(estimateDue("16H", MON_0815))).toBe("Tue 10 Nov, 13:15");
    expect(formatDue(estimateDue("27H", MON_0815))).toBe("Wed 11 Nov, 13:15");
  });

  it("starts the clock at 06:00 when submitted before opening or after closing", () => {
    const early = new Date("2026-11-09T02:00:00.000Z"); // 04:00 Johannesburg
    expect(formatDue(estimateDue("1H", early))).toBe("Mon 9 Nov, 07:00");
    const late = new Date("2026-11-09T16:00:00.000Z"); // 18:00 Johannesburg
    expect(formatDue(estimateDue("1H", late))).toBe("Tue 10 Nov, 07:00");
  });

  it("returns null for ASAP and unknown urgencies", () => {
    expect(estimateDue("ASAP", MON_0815)).toBeNull();
    expect(estimateDue("48H", MON_0815)).toBeNull();
  });
});

describe("businessMinutesBetween", () => {
  it("counts only business hours", () => {
    expect(businessMinutesBetween(MON_0815, new Date("2026-11-09T07:15:00.000Z"))).toBe(60);
    // 16:00 Monday to 07:00 Tuesday = 60 min Monday + 60 min Tuesday
    expect(
      businessMinutesBetween(new Date("2026-11-09T14:00:00.000Z"), new Date("2026-11-10T05:00:00.000Z")),
    ).toBe(120);
  });
});

const ticket = (over: Partial<TicketSummary> = {}): TicketSummary => ({
  id: "t1",
  ticketNumber: "T-0001",
  title: "Task",
  urgency: "4H",
  assignees: ["Marco"],
  status: "OPEN",
  dueAt: "2026-11-09T10:15:00.000Z",
  urgencyMinutes: 240,
  hasUpdate: false,
  followUpSentAt: null,
  gleedTaggedAt: null,
  clickupTaskUrl: null,
  lastError: null,
  createdAt: "2026-11-09T06:15:00.000Z",
  ...over,
});

describe("ticketStatus", () => {
  const before = new Date("2026-11-09T07:00:00.000Z");
  it("describes each stage in plain words", () => {
    expect(ticketStatus(ticket({ status: "SUBMITTED" }), before).label).toBe("Creating in ClickUp");
    expect(ticketStatus(ticket({ status: "FAILED" }), before).tone).toBe("bad");
    expect(ticketStatus(ticket({ status: "CLOSED" }), before).label).toBe("Done");
    expect(ticketStatus(ticket(), before).label).toBe("On track");
    expect(ticketStatus(ticket({ followUpSentAt: "2026-11-09T08:00:00.000Z" }), before).label).toBe("Follow-up sent");
    expect(ticketStatus(ticket({ gleedTaggedAt: "2026-11-09T09:00:00.000Z", followUpSentAt: "x" }), before).label).toBe("Escalated to Inkulu");
    expect(ticketStatus(ticket({ hasUpdate: true, gleedTaggedAt: "x" }), before).label).toBe("Update received");
  });

  it("flags overdue only for open tasks past their due date", () => {
    const after = new Date("2026-11-09T11:00:00.000Z");
    expect(isOverdue(ticket(), after)).toBe(true);
    expect(ticketStatus(ticket(), after).label).toBe("Overdue");
    expect(isOverdue(ticket({ status: "CLOSED" }), after)).toBe(false);
    expect(isOverdue(ticket({ dueAt: null }), after)).toBe(false);
  });
});

describe("ticketProgress", () => {
  it("is the share of business minutes used, capped at 100", () => {
    expect(ticketProgress(ticket(), new Date("2026-11-09T08:15:00.000Z"))).toBe(50); // 120 of 240
    expect(ticketProgress(ticket(), new Date("2026-11-09T20:00:00.000Z"))).toBe(100);
  });

  it("is null when there is nothing to measure", () => {
    expect(ticketProgress(ticket({ urgencyMinutes: 0 }))).toBeNull();
    expect(ticketProgress(ticket({ urgencyMinutes: null }))).toBeNull();
    expect(ticketProgress(ticket({ status: "CLOSED" }))).toBeNull();
  });
});