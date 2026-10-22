// src/app/jobcards/components/TelegramGroupPicker.tsx  (NEW FILE)
import { useEffect, useState } from "react";
import { Loader2, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addTelegramGroup, listTelegramGroups, setTelegramGroup } from "@/services/jobCardTime.service";
import type { JobCard, TelegramGroupRow } from "@/types/jobcards.types";

const NONE = "__none__";

/** Pick the Telegram group this job card posts its results to. One group per job card; a group can serve many. */
export default function TelegramGroupPicker({
  jobCard, canEdit, onError,
}: { jobCard: Pick<JobCard, "id" | "status" | "telegramGroupId">; canEdit: boolean; onError: (m: string) => void }) {
  const [groups, setGroups] = useState<TelegramGroupRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [chatId, setChatId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listTelegramGroups()
      .then((g) => { if (!cancelled) setGroups(g); })
      .catch((e) => { if (!cancelled) { setGroups([]); onError(e instanceof Error ? e.message : "Could not load Telegram groups."); } });
    return () => { cancelled = true; };
  }, [onError]);

  const current = jobCard.telegramGroupId ?? NONE;
  const disabled = !canEdit || jobCard.status !== "OPEN" || saving || groups === null;
  const known = groups?.some((g) => g.id === current);

  const change = async (value: string) => {
    setSaving(true);
    try { await setTelegramGroup(jobCard.id, value === NONE ? null : value); }
    catch (e) { onError(e instanceof Error ? e.message : "Could not link the Telegram group."); }
    finally { setSaving(false); }
  };

  const openDialog = () => { setGroupName(""); setChatId(""); setFormError(null); setDialogOpen(true); };

  // Add a group by hand, then link it to this job card (if it is still open).
  const addGroup = async () => {
    setAdding(true);
    setFormError(null);
    try {
      const { group } = await addTelegramGroup({ groupName, chatId });
      setGroups((prev) => [...(prev ?? []).filter((g) => g.id !== group.id), group]
        .sort((a, b) => (a.groupName ?? a.chatId).localeCompare(b.groupName ?? b.chatId)));
      if (jobCard.status === "OPEN") await setTelegramGroup(jobCard.id, group.id);
      setDialogOpen(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not add the group.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Send className="h-3.5 w-3.5" /> Telegram group {saving && <Loader2 className="h-3 w-3 animate-spin" />}
      </p>
      <Select value={current} onValueChange={change} disabled={disabled}>
        <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Choose a group" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>No group linked</SelectItem>
          {groups?.map((g) => (
            <SelectItem key={g.id} value={g.id}>{(g.groupName || g.chatId) + (g.active === false ? " (inactive)" : "")}</SelectItem>
          ))}
          {groups && current !== NONE && !known && <SelectItem value={current}>Unknown group</SelectItem>}
        </SelectContent>
      </Select>
      {groups?.length === 0 && (
        <p className="text-[11px] text-muted-foreground">No groups yet. Add the Omni-NexOS bot to a Telegram group, or add one by hand.</p>
      )}
      {canEdit && (
        <Button type="button" variant="link" size="sm" className="h-auto cursor-pointer p-0 text-xs" onClick={openDialog}>
          <Plus className="mr-1 h-3 w-3" /> Add group by name and chat ID
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !adding && setDialogOpen(o)}>
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); void addGroup(); }} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add Telegram group</DialogTitle>
              <DialogDescription>
                The name is only a label for the list. The chat ID is what results are sent to, so it must be exact.
                {jobCard.status === "OPEN" ? " The group is linked to this job card once added." : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="tg-name" className="text-sm font-medium">Group name</label>
                <Input id="tg-name" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Klipfontein JC group" autoFocus />
              </div>
              <div className="space-y-1">
                <label htmlFor="tg-chat" className="text-sm font-medium">Chat ID</label>
                <Input id="tg-chat" value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="-1001234567890" inputMode="numeric" />
                <p className="text-[11px] text-muted-foreground">A number. Group chat IDs start with a minus sign.</p>
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="cursor-pointer" disabled={adding} onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="cursor-pointer" disabled={adding || !groupName.trim() || !chatId.trim()}>
                {adding && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Add group
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}