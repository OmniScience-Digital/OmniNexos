// src/app/jobcards/components/WorkItemsCard.tsx
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addScale, addWorkItem, removeWorkItem } from "@/services/jobCardTime.service";
import {
  WORK_ITEM_LABEL, type JobCard, type JobCardScale, type TimeUser, type WorkItem, type WorkItemType,
} from "@/types/jobcards.types";

interface Props {
  jobCard: JobCard;
  scales: JobCardScale[];
  items: WorkItem[];
  user: TimeUser | null;
  canEdit: boolean;
  onError: (message: string) => void;
}

/** Assign work items to scales. Adding the first one is what starts the user's time entry. */
export default function WorkItemsCard({ jobCard, scales, items, user, canEdit, onError }: Props) {
  const [newScale, setNewScale] = useState("");
  const [pickType, setPickType] = useState<Record<string, WorkItemType>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const editable = canEdit && jobCard.status === "OPEN" && !!user;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e) { onError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(null); }
  };

  return (
    <Card className="shadow-none">
      <CardHeader><CardTitle className="text-base">Scales and work items</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {scales.length === 0 && <p className="text-sm text-muted-foreground">No scales yet. Add the first scale to start assigning work.</p>}

        {[...scales].sort((a, b) => a.scaleName.localeCompare(b.scaleName)).map((sc) => {
          const rows = items.filter((i) => i.scaleId === sc.id).sort((a, b) => a.sequence - b.sequence);
          const type = pickType[sc.id] ?? "ZERO_CALIBRATION";
          return (
            <div key={sc.id} className="rounded-lg border border-border p-3">
              <p className="font-medium">{sc.scaleName}</p>
              <ul className="mt-2 space-y-1.5">
                {rows.length === 0 && <li className="text-sm text-muted-foreground">No work items assigned.</li>}
                {rows.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{WORK_ITEM_LABEL[i.moduleType]} #{i.sequence}</span>
                    <span className="flex items-center gap-2">
                      <Badge variant={i.status === "SUBMITTED" ? "secondary" : "outline"}>
                        {i.status === "SUBMITTED" ? "Submitted" : "Pending"}
                      </Badge>
                      {editable && i.status === "PENDING" && (
                        <Button
                          size="icon-sm" variant="ghost" aria-label="Remove work item"
                          disabled={busy === i.id} onClick={() => run(i.id, () => removeWorkItem(i))}
                        >
                          {busy === i.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {editable && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Select value={type} onValueChange={(v) => setPickType((p) => ({ ...p, [sc.id]: v as WorkItemType }))}>
                    <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(WORK_ITEM_LABEL) as WorkItemType[]).map((t) => (
                        <SelectItem key={t} value={t}>{WORK_ITEM_LABEL[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm" disabled={busy === `add-${sc.id}`}
                    onClick={() => run(`add-${sc.id}`, () => addWorkItem({ jobCard, scaleId: sc.id, type, user: user! }))}
                  >
                    {busy === `add-${sc.id}` ? <Loader2 className="animate-spin" /> : <Plus />} Assign
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {editable && (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newScale.trim()) return;
              void run("scale", async () => { await addScale(jobCard.id, newScale); setNewScale(""); });
            }}
          >
            <Input className="w-64" placeholder="Scale name, e.g. CV04 ROM accounting" value={newScale} onChange={(e) => setNewScale(e.target.value)} />
            <Button type="submit" variant="outline" size="sm" disabled={busy === "scale" || !newScale.trim()}>
              {busy === "scale" ? <Loader2 className="animate-spin" /> : <Plus />} Add scale
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}