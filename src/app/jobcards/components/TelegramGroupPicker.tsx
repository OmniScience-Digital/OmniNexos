// src/app/jobcards/components/TelegramGroupPicker.tsx  
import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listTelegramGroups, setTelegramGroup } from "@/services/jobCardTime.service";
import type { JobCard, TelegramGroupRow } from "@/types/jobcards.types";

const NONE = "__none__";

/** Pick the Telegram group this job card posts its results to. One group per job card; a group can serve many. */
export default function TelegramGroupPicker({
  jobCard, canEdit, onError,
}: { jobCard: Pick<JobCard, "id" | "status" | "telegramGroupId">; canEdit: boolean; onError: (m: string) => void }) {
  const [groups, setGroups] = useState<TelegramGroupRow[] | null>(null);
  const [saving, setSaving] = useState(false);

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
        <p className="text-[11px] text-muted-foreground">No groups yet. Add the Omni-NexOS bot to a Telegram group and it will appear here.</p>
      )}
    </div>
  );
}