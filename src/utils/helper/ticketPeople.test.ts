// src/utils/helper/ticketPeople.test.ts
import { describe, expect, it } from "vitest";
import {
  buildPickerPeople,
  planPickedChanges,
  seedFromStandardList,
  validateDraft,
  type DraftPerson,
} from "./ticketPeople";
import { SHEET_PEOPLE, type ClickUpMember, type PickedPerson } from "@/types/ticket.types";

const member = (id: string, name: string, over: Partial<ClickUpMember> = {}): ClickUpMember => ({ id, name, ...over });
const row = (id: string, displayName: string, clickupUserId: string | null, sortOrder = 0): PickedPerson => ({
  id,
  displayName,
  clickupUserId,
  sortOrder,
});

describe("buildPickerPeople", () => {
  const members = [member("10", "Marco Rougier", { avatarUrl: "a.png" }), member("11", "Someone Else"), member("7", "G")];

  it("offers only the people on the list, never other ClickUp users", () => {
    const people = buildPickerPeople([row("1", "Marco", "10"), row("2", "Gleed", "7")], members);
    expect(people.map((p) => p.label)).toEqual(["Marco", "Gleed"].sort((a, b) => a.localeCompare(b)));
    expect(people.some((p) => p.label === "Someone Else")).toBe(false);
  });

  it("shows the chosen name, saves it as the value, and keeps the ClickUp link and avatar", () => {
    const [marco] = buildPickerPeople([row("1", "Marco", "10")], members);
    expect(marco).toMatchObject({ label: "Marco", value: "Marco", clickupUserId: "10", avatarUrl: "a.png" });
  });

  it("shows Gleed once, linked to the G account", () => {
    const people = buildPickerPeople([row("2", "Gleed", "7")], members);
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({ label: "Gleed", clickupUserId: "7" });
  });

  it("treats a person whose ClickUp user has left as having no ClickUp account", () => {
    const people = buildPickerPeople([row("1", "Marco", "10")], [member("10", "Marco Rougier", { isActive: false })]);
    expect(people[0].clickupUserId).toBeNull();
    expect(buildPickerPeople([row("1", "Marco", "999")], members)[0].clickupUserId).toBeNull();
  });

  it("keeps people with no ClickUp account, skips blanks and duplicate names, follows the saved order", () => {
    const people = buildPickerPeople(
      [row("1", "Zed", null, 0), row("2", "  ", null, 1), row("3", "zed", null, 2), row("4", "Abe", null, 3)],
      members,
    );
    expect(people.map((p) => p.label)).toEqual(["Zed", "Abe"]);
    expect(people[0].clickupUserId).toBeNull();
  });
});

describe("seedFromStandardList", () => {
  it("returns the standard names, linked to ClickUp when one matches, and nobody else", () => {
    const seed = seedFromStandardList([member("10", "Marco Rougier"), member("11", "Unrelated Person")]);
    expect(seed.map((s) => s.displayName).sort()).toEqual([...SHEET_PEOPLE].sort());
    expect(seed.find((s) => s.displayName === "Marco")?.clickupUserId).toBe("10");
    expect(seed.find((s) => s.displayName === "Willie")?.clickupUserId).toBeNull();
    expect(seed.some((s) => s.displayName === "Unrelated Person")).toBe(false);
  });

  it("does not include Gleed (he comes from ClickUp as G)", () => {
    expect(seedFromStandardList([]).some((s) => s.displayName === "Gleed")).toBe(false);
  });
});

describe("validateDraft", () => {
  const d = (displayName: string, clickupUserId: string | null = null): DraftPerson => ({ displayName, clickupUserId });
  it("accepts a clean list, including an empty one", () => {
    expect(validateDraft([d("Marco", "10"), d("Willie")])).toBeNull();
    expect(validateDraft([])).toBeNull();
  });
  it("rejects blank names, repeated names (any case) and the same ClickUp user twice", () => {
    expect(validateDraft([d("  ")])).toMatch(/needs a name/);
    expect(validateDraft([d("Marco"), d("marco ")])).toMatch(/twice/);
    expect(validateDraft([d("A", "1"), d("B", "1")])).toMatch(/same ClickUp user/);
  });
});

describe("planPickedChanges", () => {
  const d = (displayName: string, clickupUserId: string | null = null): DraftPerson => ({ displayName, clickupUserId });

  it("creates everything for an empty saved list, stored alphabetically", () => {
    const plan = planPickedChanges([], [d("Marco", "10"), d("Byron")]);
    expect(plan.creates).toEqual([
      { displayName: "Byron", clickupUserId: null, sortOrder: 0 },
      { displayName: "Marco", clickupUserId: "10", sortOrder: 1 },
    ]);
    expect(plan.updates).toEqual([]);
    expect(plan.deletes).toEqual([]);
  });

  it("changes nothing when the draft equals the saved list", () => {
    const saved = [row("1", "Byron", null, 0), row("2", "Marco", "10", 1)];
    expect(planPickedChanges(saved, [d("Marco", "10"), d("Byron")])).toEqual({ creates: [], updates: [], deletes: [] });
  });

  it("renames a ClickUp person in place, removes who was unticked, adds who is new", () => {
    const saved = [row("1", "G", "7", 0), row("2", "Old", null, 1)];
    const plan = planPickedChanges(saved, [d("Gleed", "7"), d("Marco", "10")]);
    expect(plan.updates).toEqual([{ id: "1", displayName: "Gleed", clickupUserId: "7", sortOrder: 0 }]);
    expect(plan.creates).toEqual([{ displayName: "Marco", clickupUserId: "10", sortOrder: 1 }]);
    expect(plan.deletes).toEqual(["2"]);
  });

  it("clearing the whole list deletes every saved row", () => {
    expect(planPickedChanges([row("1", "A", null), row("2", "B", "5")], []).deletes.sort()).toEqual(["1", "2"]);
  });
});