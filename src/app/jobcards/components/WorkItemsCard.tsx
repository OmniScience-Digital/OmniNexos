// src/app/jobcards/components/WorkItemsCard.tsx
import { useState } from "react";
import { CheckCircle2, Circle, Loader2, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { addScale, addWorkItem, removeScale, removeWorkItem } from "@/services/jobCardTime.service";
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

const TYPES = Object.keys(WORK_ITEM_LABEL) as WorkItemType[];

/**
 * Add scales and work items to a job card. Work items are not assigned to individual people: the whole job card is
 * assigned (see AssignJobCard) and any technician can work on any item. Adding work engages the user's time entry.
 */
export default function WorkItemsCard({ jobCard, scales, items, user, canEdit, onError }: Props) {
  const [newScale, setNewScale] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<JobCardScale | null>(null);
  const editable = canEdit && jobCard.status === "OPEN" && !!user;

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try { await fn(); } catch (e) { onError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(null); }
  };

  const sorted = [...scales].sort((a, b) => a.scaleName.localeCompare(b.scaleName));
  const confirmItems = confirm ? items.filter((i) => i.scaleId === confirm.id) : [];

  return (
    <div className="space-y-4">
      {editable && (
        <div className="flex flex-wrap items-end justify-between gap-3">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newScale.trim()) return;
            void run("scale", async () => { await addScale(jobCard.id, newScale); setNewScale(""); });
          }}
        >
          <Input className="w-72 max-w-full" placeholder="Add a scale, e.g. CV04 ROM accounting" value={newScale} onChange={(e) => setNewScale(e.target.value)} />
          <Button type="submit" size="sm" disabled={busy === "scale" || !newScale.trim()} className="cursor-pointer">
            {busy === "scale" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />} Add scale
          </Button>
        </form>
        </div>
      )}
      {sorted.length === 0 && (
        <Card className="shadow-none">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No scales yet.{editable ? " Add the first scale to start assigning work." : ""}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {sorted.map((sc) => {
          const rows = items.filter((i) => i.scaleId === sc.id).sort((a, b) => a.sequence - b.sequence);
          const done = rows.filter((i) => i.status === "SUBMITTED").length;
          const hasResults = done > 0;
          return (
            <Card key={sc.id} className="shadow-none">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{sc.scaleName}</p>
                    <p className="text-xs text-muted-foreground">
                      {rows.length === 0 ? "No work assigned" : `${done} of ${rows.length} submitted`}
                    </p>
                  </div>
                  {editable && (
                    <Button
                      size="icon-sm" variant="ghost" className="cursor-pointer text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${sc.scaleName}`} disabled={hasResults}
                      title={hasResults ? "Has submitted results, cannot be removed" : "Remove scale"}
                      onClick={() => setConfirm(sc)}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>

                {rows.length > 0 && <Progress value={(done / rows.length) * 100} className="h-1.5" />}

                <ul className="space-y-1">
                  {rows.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                      <span className="flex items-center gap-2">
                        {i.status === "SUBMITTED"
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          : <Circle className="h-4 w-4 text-muted-foreground" />}
                        {WORK_ITEM_LABEL[i.moduleType]} #{i.sequence}
                      </span>
                      <span className="flex flex-wrap items-center justify-end gap-1">
                        <Badge variant={i.status === "SUBMITTED" ? "secondary" : "outline"} className="text-[10px]">
                          {i.status === "SUBMITTED" ? "Submitted" : "Pending"}
                        </Badge>
                        {editable && i.status === "PENDING" && (
                          <Button
                            size="icon-sm" variant="ghost" className="cursor-pointer text-muted-foreground hover:text-destructive"
                            aria-label="Remove work item" disabled={busy === i.id} onClick={() => run(i.id, () => removeWorkItem(i))}
                          >
                            {busy === i.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                          </Button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>

                {editable && (
                  <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
                    {TYPES.map((t) => (
                      <Button
                        key={t} size="sm" variant="outline" className="h-7 cursor-pointer px-2 text-xs"
                        disabled={busy === `add-${sc.id}-${t}`}
                        onClick={() => run(`add-${sc.id}-${t}`, () => addWorkItem({ jobCard, scaleId: sc.id, type: t, user: user! }))}
                      >
                        {busy === `add-${sc.id}-${t}` ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
                        {WORK_ITEM_LABEL[t]}
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {confirm?.scaleName}?</DialogTitle>
            <DialogDescription>
              {confirmItems.length === 0
                ? "This scale has no work items."
                : `Its ${confirmItems.length} pending work item${confirmItems.length === 1 ? "" : "s"} will be removed too.`}{" "}
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive" className="cursor-pointer" disabled={busy === "remove-scale"}
              onClick={() => confirm && run("remove-scale", async () => { await removeScale(confirm); setConfirm(null); })}
            >
              {busy === "remove-scale" && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Remove scale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}