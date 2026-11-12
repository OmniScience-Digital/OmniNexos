// src/components/ticketing/ManagePeopleDialog.tsx
// TICKETING: the "Manage people" pop-up. It decides who appears in the Task Form's "Assign to"
// dropdown. Tick people from all ClickUp users, give each the name you want shown (for example tick
// the ClickUp user "G" and call them "Gleed"), or add a name that has no ClickUp account.
// Only the people ticked here can be picked on the form. The list is shared by everybody.
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { savePickedPeople } from "@/services/ticket.service";
import type { ClickUpMember, PickedPerson } from "@/types/ticket.types";
import { initials } from "@/utils/helper/ticket";
import {
  seedFromStandardList,
  validateDraft,
  type DraftPerson,
} from "@/utils/helper/ticketPeople";

interface ManagePeopleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Everyone synced from ClickUp. */
  members: ClickUpMember[];
  /** The list as saved now. */
  picked: PickedPerson[];
  /** Called after a successful save so the page can reload the list. */
  onSaved: () => void;
}

export default function ManagePeopleDialog({
  open,
  onOpenChange,
  members,
  picked,
  onSaved,
}: ManagePeopleDialogProps) {
  const [draft, setDraft] = useState<DraftPerson[]>([]);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start from the saved list each time the pop-up opens.
  useEffect(() => {
    if (!open) return;
    setDraft(picked.map((p) => ({ displayName: p.displayName, clickupUserId: p.clickupUserId })));
    setQuery("");
    setNewName("");
    setError(null);
  }, [open, picked]);

  const active = useMemo(
    () =>
      members
        .filter((m) => m.isActive !== false && m.name.trim() !== "")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [members],
  );
  const q = query.trim().toLowerCase();
  const shown = q ? active.filter((m) => m.name.toLowerCase().includes(q)) : active;

  const entryFor = (id: string) => draft.find((d) => d.clickupUserId === id);

  const tick = (m: ClickUpMember, on: boolean) =>
    setDraft((d) =>
      on
        ? [...d, { displayName: m.name.trim(), clickupUserId: m.id }]
        : d.filter((x) => x.clickupUserId !== m.id),
    );

  const rename = (index: number, displayName: string) =>
    setDraft((d) => d.map((x, i) => (i === index ? { ...x, displayName } : x)));

  const addName = () => {
    const name = newName.trim();
    if (!name) return;
    setDraft((d) => [...d, { displayName: name, clickupUserId: null }]);
    setNewName("");
  };

  const save = async () => {
    const problem = validateDraft(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await savePickedPeople(picked, draft);
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The list could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const noAccount = draft.map((d, index) => ({ d, index })).filter(({ d }) => !d.clickupUserId);

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Manage people</DialogTitle>
          <DialogDescription>
            Only the people ticked here appear in the Assign to dropdown. Everyone else in ClickUp
            stays hidden.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ClickUp people"
            aria-label="Search ClickUp people"
          />
          {draft.length === 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDraft(seedFromStandardList(members))}
            >
              Use the standard names
            </Button>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <section aria-label="ClickUp people" className="space-y-1">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              ClickUp people
            </h3>
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No ClickUp people yet. They are copied from ClickUp a few minutes after the server
                starts.
              </p>
            ) : shown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No one matches that search.</p>
            ) : (
              shown.map((m) => {
                const entry = entryFor(m.id);
                const index = entry ? draft.indexOf(entry) : -1;
                const checkId = `manage-${m.id}`;
                return (
                  <div key={m.id} className="flex items-center gap-2.5 rounded-md px-1 py-1.5">
                    <Checkbox
                      id={checkId}
                      checked={Boolean(entry)}
                      onCheckedChange={(c) => tick(m, c === true)}
                    />
                    <Avatar size="sm">
                      {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt="" />}
                      <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
                        {initials(m.name)}
                      </AvatarFallback>
                    </Avatar>
                    <label htmlFor={checkId} className="min-w-0 flex-1 cursor-pointer truncate text-sm">
                      {m.name}
                    </label>
                    {entry && (
                      <Input
                        value={entry.displayName}
                        onChange={(e) => rename(index, e.target.value)}
                        aria-label={`Name shown for ${m.name}`}
                        className="h-8 w-40"
                      />
                    )}
                  </div>
                );
              })
            )}
          </section>

          <section aria-label="Names without a ClickUp account" className="space-y-1">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Names without a ClickUp account
            </h3>
            <p className="text-xs text-muted-foreground">
              Their tasks go to the fallback user set on the server.
            </p>
            {noAccount.map(({ d, index }) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={d.displayName}
                  onChange={(e) => rename(index, e.target.value)}
                  aria-label="Name"
                  className="h-8"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${d.displayName || "name"}`}
                  onClick={() => setDraft((list) => list.filter((_, i) => i !== index))}
                >
                  <X />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addName();
                  }
                }}
                placeholder="Add a name"
                aria-label="Add a name without a ClickUp account"
                className="h-8"
              />
              <Button type="button" variant="outline" size="sm" onClick={addName} disabled={!newName.trim()}>
                <Plus />
                Add
              </Button>
            </div>
          </section>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">{draft.length} on the list</span>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Saving" : "Save list"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}