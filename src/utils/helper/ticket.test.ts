// src/utils/helper/ticket.test.ts
import { describe, expect, it } from "vitest";
import {
  OUTCOME_MAX,
  TITLE_MAX,
  buildTicketInput,
  emptyTicketForm,
  formatDue,
  validateTicketForm,
} from "./ticket";
import type { TicketFormValues } from "@/types/ticket.types";

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

  it("needs at least one known assignee", () => {
    expect(validateTicketForm(valid({ assignees: [] })).assignees).toBeDefined();
    expect(validateTicketForm(valid({ assignees: ["Nobody"] })).assignees).toBeDefined();
    expect(validateTicketForm(valid({ assignees: ["Marco", "Byron"] })).assignees).toBeUndefined();
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