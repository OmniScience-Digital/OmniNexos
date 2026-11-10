// src/components/ticketing/PeoplePicker.tsx
// TICKETING: the "Assign to" dropdown for the Task Form. It looks and behaves like the site's
// other selects: a closed field you click, and the list opens underneath. You can pick several
// people; the list stays open until you click away. Picked people also show as removable chips.
// Everyone is listed. People who are in ClickUp carry a small highlighted "ClickUp user" tag.
// Built from the site's own theme tokens and the Radix popover already bundled in `radix-ui`.
import { useState } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Check, ChevronDown, RefreshCw, X } from "lucide-react";
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

function PersonAvatar({ person }: { person: Pick<Person, "label" | "avatarUrl"> }) {
  return (
    <Avatar size="sm">
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const byValue = new Map(people.map((p) => [p.value, p]));
  const q = query.trim().toLowerCase();
  const visible = q ? people.filter((p) => p.label.toLowerCase().includes(q)) : people;

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  const labelOf = (value: string) => byValue.get(value)?.label ?? value;

  const syncText = loading
    ? "Loading ClickUp people"
    : !hasClickUp
      ? "ClickUp list not available, showing the standard list"
      : syncedAt
        ? `Synced from ClickUp ${DateTime.fromJSDate(syncedAt).toRelative() ?? ""}`.trim()
        : "Synced from ClickUp";

  return (
    <div className="space-y-2">
      <PopoverPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <PopoverPrimitive.Trigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={cn(
              "flex h-9 w-full items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              invalid && "border-destructive",
            )}
          >
            <span className={cn("truncate", selected.length === 0 && "text-muted-foreground")}>
              {selected.length === 0 ? "Select people" : selected.map(labelOf).join(", ")}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
          </button>
        </PopoverPrimitive.Trigger>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            sideOffset={4}
            className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[16rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          >
            <div className="border-b p-2">
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people"
                aria-label="Search people"
              />
            </div>

            <div
              role="listbox"
              aria-multiselectable="true"
              aria-label="People"
              className="max-h-60 overflow-y-auto p-1"
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
                        "flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none",
                        on && "bg-accent/60",
                      )}
                    >
                      <PersonAvatar person={p} />
                      <span className="flex-1 truncate">{p.label}</span>
                      {p.clickupUserId && <ClickUpTag />}
                      <Check
                        className={cn("h-4 w-4 text-primary", !on && "invisible")}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex flex-col gap-1 border-t px-3 py-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                {syncText}
              </span>
              <span>People not on ClickUp are given to Gleed.</span>
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-live="polite">
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
      )}
    </div>
  );
}