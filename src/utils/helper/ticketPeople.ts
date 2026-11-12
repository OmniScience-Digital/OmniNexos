// src/utils/helper/ticketPeople.ts
// TICKETING: the reusable people list. Only the people on this list appear in the "Assign to"
// dropdown. They are chosen in the "Manage people" pop-up from all ClickUp users (or added by name
// when they have no ClickUp account). Pure functions, no React and no Amplify, so they are easy to test.
import {
  SHEET_ALIASES,
  SHEET_PEOPLE,
  type ClickUpMember,
  type PickedPerson,
  type Person,
} from "@/types/ticket.types";
import { buildPeople } from "@/utils/helper/ticket";

/** A person in the pop-up before it is saved. */
export interface DraftPerson {
  displayName: string;
  clickupUserId: string | null;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * What the dropdown offers: exactly the people on the list, nobody else. A person linked to a
 * ClickUp user who has since left ClickUp stays selectable but counts as having no ClickUp account,
 * so the backend gives their task to the fallback user instead of failing.
 */
export function buildPickerPeople(
  picked: readonly PickedPerson[],
  members: readonly ClickUpMember[],
): Person[] {
  const active = new Map(members.filter((m) => m.isActive !== false).map((m) => [m.id, m]));
  const seen = new Set<string>();
  const people: { person: Person; order: number }[] = [];

  for (const p of picked) {
    const name = p.displayName.trim();
    if (!name || seen.has(norm(name))) continue;
    seen.add(norm(name));
    const m = p.clickupUserId ? active.get(p.clickupUserId) : undefined;
    people.push({
      order: p.sortOrder,
      person: {
        key: `picked:${p.id}`,
        label: name,
        value: name,
        clickupUserId: m ? m.id : null,
        avatarUrl: m?.avatarUrl ?? null,
      },
    });
  }
  return people
    .sort((a, b) => a.order - b.order || a.person.label.localeCompare(b.person.label))
    .map((x) => x.person);
}

/**
 * The starting list for the "Use the standard names" button: the standard names, each linked to its
 * ClickUp user when one matches, and no one else from ClickUp.
 */
export function seedFromStandardList(
  members: readonly ClickUpMember[],
  sheet: readonly string[] = SHEET_PEOPLE,
  aliases: Record<string, string[]> = SHEET_ALIASES,
): DraftPerson[] {
  const standard = new Set<string>(sheet);
  return buildPeople(members, sheet, aliases)
    .filter((p) => standard.has(p.value))
    .map((p) => ({ displayName: p.value, clickupUserId: p.clickupUserId }));
}

/** A message when the draft cannot be saved, or null when it is fine. */
export function validateDraft(draft: readonly DraftPerson[]): string | null {
  const names = new Set<string>();
  const users = new Set<string>();
  for (const d of draft) {
    if (!d.displayName.trim()) return "Every person needs a name.";
    if (names.has(norm(d.displayName))) return `"${d.displayName.trim()}" is on the list twice.`;
    names.add(norm(d.displayName));
    if (d.clickupUserId) {
      if (users.has(d.clickupUserId)) return "The same ClickUp user is on the list twice.";
      users.add(d.clickupUserId);
    }
  }
  return null;
}

export interface PickedChanges {
  creates: { displayName: string; clickupUserId: string | null; sortOrder: number }[];
  updates: { id: string; displayName: string; clickupUserId: string | null; sortOrder: number }[];
  deletes: string[];
}

/**
 * Works out the smallest set of writes that turns the saved list into the draft. A draft entry
 * keeps its saved row when it has the same ClickUp user (so renaming works) or, for people with no
 * ClickUp account, the same name. The list is stored alphabetically.
 */
export function planPickedChanges(
  current: readonly PickedPerson[],
  draft: readonly DraftPerson[],
): PickedChanges {
  const ordered = [...draft].sort((a, b) => a.displayName.localeCompare(b.displayName));
  const unused = new Map(current.map((c) => [c.id, c]));
  const byClickUp = new Map(current.filter((c) => c.clickupUserId).map((c) => [c.clickupUserId as string, c]));
  const byName = new Map(current.filter((c) => !c.clickupUserId).map((c) => [norm(c.displayName), c]));

  const plan: PickedChanges = { creates: [], updates: [], deletes: [] };
  ordered.forEach((d, i) => {
    const name = d.displayName.trim();
    const match = d.clickupUserId ? byClickUp.get(d.clickupUserId) : byName.get(norm(name));
    if (match && unused.has(match.id)) {
      unused.delete(match.id);
      if (match.displayName !== name || match.clickupUserId !== d.clickupUserId || match.sortOrder !== i) {
        plan.updates.push({ id: match.id, displayName: name, clickupUserId: d.clickupUserId, sortOrder: i });
      }
    } else {
      plan.creates.push({ displayName: name, clickupUserId: d.clickupUserId, sortOrder: i });
    }
  });
  plan.deletes = [...unused.keys()];
  return plan;
}