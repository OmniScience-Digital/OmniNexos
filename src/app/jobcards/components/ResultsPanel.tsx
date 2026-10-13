// src/app/jobcards/components/ResultsPanel.tsx  (NEW FILE)
import { CheckCircle2, ClipboardList, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  WORK_ITEM_LABEL, type DeliveryStatus, type JobCardScale, type Submission, type TimeEntry, type WorkItem,
} from "@/types/jobcards.types";
import { describeResult } from "@/utils/helper/jobCardResults";
import PhotoThumb from "./PhotoThumb";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-ZA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function Delivery({ label, status }: { label: string; status?: DeliveryStatus | null }) {
  const sent = status === "SENT";
  const failed = status === "FAILED";
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${failed ? "text-destructive" : sent ? "text-emerald-600" : "text-muted-foreground"}`}>
      {failed ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
      {label}: {sent ? "sent" : failed ? "failed" : "pending"}
    </span>
  );
}

/** Submitted results, grouped by scale. Results are immutable: a correction is a newer result, older ones are marked. */
export default function ResultsPanel({
  scales, items, results, entries,
}: { scales: JobCardScale[]; items: WorkItem[]; results: Submission[]; entries: TimeEntry[] }) {
  const names = new Map(entries.map((e) => [e.userId, e.userName || ""]));
  const itemById = new Map(items.map((i) => [i.id, i]));
  const sorted = [...results].sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
  const latestPerItem = new Set<string>();
  const isLatest = (r: Submission) => {
    if (latestPerItem.has(r.moduleId)) return false;
    latestPerItem.add(r.moduleId);
    return true;
  };
  const rows = sorted.map((r) => ({ r, latest: isLatest(r) }));

  if (results.length === 0) {
    return (
      <Card className="shadow-none">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          <ClipboardList className="mx-auto mb-2 h-6 w-6 opacity-50" />
          No results yet. They appear here as technicians complete work items.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {[...scales].sort((a, b) => a.scaleName.localeCompare(b.scaleName)).map((sc) => {
        const mine = rows.filter(({ r }) => r.scaleId === sc.id);
        if (mine.length === 0) return null;
        return (
          <section key={sc.id} className="space-y-2">
            <h3 className="text-sm font-semibold">{sc.scaleName}</h3>
            {mine.map(({ r, latest }) => {
              const view = describeResult(r.moduleType, r.payload);
              const n = itemById.get(r.moduleId)?.sequence;
              return (
                <Card key={r.id} className={`shadow-none ${latest ? "" : "opacity-70"}`}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        {WORK_ITEM_LABEL[r.moduleType]}{n ? ` #${n}` : ""}
                        {!latest && <Badge variant="outline" className="text-[10px]">Earlier result</Badge>}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {when(r.submittedAt)}{names.get(r.submittedBy) ? ` by ${names.get(r.submittedBy)}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <Delivery label="ClickUp" status={r.clickupStatus} />
                      <Delivery label="Telegram" status={r.telegramStatus} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                      {view.fields.map((f:any) => (
                        <div key={f.label} className="flex justify-between gap-3 border-b border-border/50 pb-1">
                          <dt className="text-muted-foreground">{f.label}</dt>
                          <dd className="text-right font-medium tabular-nums">{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                    {view.photos.length > 0 && (
                      <div className="flex flex-wrap gap-3">
                        {view.photos.map((p:any) => <PhotoThumb key={p.key} storageKey={p.key} label={p.label} />)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}