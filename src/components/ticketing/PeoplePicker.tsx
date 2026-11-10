// src/components/ticketing/PeoplePicker.tsx
// TICKETING: searchable multi-select for the Task Form's "Assign to" field.
// Everyone is listed. People who are in ClickUp carry a small highlighted "ClickUp user" tag.
// Picked people show as removable chips above the list. Built only from the site's own
// components and theme colours (Avatar, Input, border/muted/primary tokens).
import { useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import { DateTime } from "luxon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Person } from "@/types/ticket.types";
import { initials } from "@/utils/helper/ticket";

interface PeoplePickerProps {
  id: string;
  people: Person[];
  /** The `value` of each picked person. */
  selected: string[];
  onChange: (values: string[]) => void;
  loading?: boolean;
  /** True when ClickUp members were loaded (so the tags mean something). */
  hasClickUp?: boolean;
  syncedAt?: Date | null;
  invalid?: boolean;
  describedBy?: string;
}

function PersonAvatar({ person, size = "sm" }: { person: Pick<Person, "label" | "avatarUrl">; size?: "sm" | "default" }) {
  return (
    <Avatar size={size}>
      {person.avatarUrl && <AvatarImage src={person.avatarUrl} alt="" />}
      <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
        {initials(person.label)}
      </AvatarFallback>
    </Avatar>
  );
}

export function ClickUpTag() {
  return (
    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-primary">
      ClickUp user
    </span>
  );
}

export default function PeoplePicker({
  id,
  people,
  selected,
  onChange,
  loading = false,
  hasClickUp = false,
  syncedAt = null,
  invalid = false,
  describedBy,
}: PeoplePickerProps) {
  const [query, setQuery] = useState("");

  const byValue = new Map(people.map((p) => [p.value, p]));
  const q = query.trim().toLowerCase();
  const visible = q ? people.filter((p) => p.label.toLowerCase().includes(q)) : people;

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  const syncText = loading
    ? "Loading ClickUp people"
    : !hasClickUp
      ? "ClickUp list not available, showing the standard list"
      : syncedAt
        ? `Synced from ClickUp ${DateTime.fromJSDate(syncedAt).toRelative() ?? ""}`.trim()
        : "Synced from ClickUp";

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-background p-1.5",
          invalid && "border-destructive",
        )}
        aria-live="polite"
      >
        {selected.length === 0 && (
          <span className="px-1.5 text-sm text-muted-foreground">No one selected</span>
        )}
        {selected.map((value) => {
          const person = byValue.get(value) ?? { label: value, avatarUrl: null };
          return (
            <span
              key={value}
              className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 py-0.5 pl-0.5 pr-1.5 text-sm"
            >
              <PersonAvatar person={person} />
              {person.label}
              <button
                type="button"
                onClick={() => toggle(value)}
                aria-label={`Remove ${person.label}`}
                className="rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          );
        })}
      </div>

      <div className="rounded-md border">
        <div className="border-b p-2">
          <Input
            id={id}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people"
            aria-label="Search people"
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        </div>

        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label="People"
          className="max-h-56 overflow-y-auto py-1"
        >
          {visible.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">No one matches that search.</p>
          ) : (
            visible.map((p) => {
              const on = selected.includes(p.value);
              return (
                <button
                  key={p.key}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => toggle(p.value)}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                    on && "bg-accent",
                  )}
                >
                  <PersonAvatar person={p} />
                  <span className="flex-1 truncate">{p.label}</span>
                  {p.clickupUserId && <ClickUpTag />}
                  {on && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
                </button>
              );
            })
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-3 py-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            {syncText}
          </span>
          <span>People not on ClickUp are given to Gleed.</span>
        </div>
      </div>
    </div>
  );
}