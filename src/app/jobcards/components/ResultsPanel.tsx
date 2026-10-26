// src/app/jobcards/components/ResultsPanel.tsx 
import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Search, X, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  WORK_ITEM_LABEL, type DeliveryStatus, type JobCardScale, type Submission, type TimeEntry, type WorkItem,
} from "@/types/jobcards.types";
import { ALL, describeResult, isFiltering, matchesResultFilter, NO_FILTER, type ResultFilter } from "@/utils/helper/jobCardResults";
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

/**
 * Submitted results, grouped by scale, with search and filters by scale and work item type.
 * Results are immutable: a correction is a newer result, older ones are marked.
 */
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
  // "latest" is decided on ALL results, before filtering, so a filter never makes an old result look current.
  const rows = sorted.map((r) => ({ r, latest: isLatest(r) }));

  const [filter, setFilter] = useState<ResultFilter>(NO_FILTER);
  const scaleNameById = useMemo(() => new Map(scales.map((sc) => [sc.id, sc.scaleName])), [scales]);
  const shown = rows.filter(({ r }) =>
    matchesResultFilter(r, { scaleName: scaleNameById.get(r.scaleId) ?? "", submitterName: names.get(r.submittedBy) }, filter),
  );
  const scalesWithResults = [...scales]
    .filter((sc) => results.some((r) => r.scaleId === sc.id))
    .sort((a, b) => a.scaleName.localeCompare(b.scaleName));

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
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-8 w-56 pl-8 text-xs" placeholder="Search results" aria-label="Search results"
            value={filter.term} onChange={(e) => setFilter((f) => ({ ...f, term: e.target.value }))}
          />
        </div>
        <Select value={filter.scaleId} onValueChange={(v) => setFilter((f) => ({ ...f, scaleId: v }))}>
          <SelectTrigger className="h-8 w-52 text-xs" aria-label="Filter by scale"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All scales</SelectItem>
            {scalesWithResults.map((sc) => <SelectItem key={sc.id} value={sc.id}>{sc.scaleName}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filter.type} onValueChange={(v) => setFilter((f) => ({ ...f, type: v as ResultFilter["type"] }))}>
          <SelectTrigger className="h-8 w-44 text-xs" aria-label="Filter by work item"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All work items</SelectItem>
            {(Object.keys(WORK_ITEM_LABEL) as (keyof typeof WORK_ITEM_LABEL)[]).map((t) => (
              <SelectItem key={t} value={t}>{WORK_ITEM_LABEL[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isFiltering(filter) && (
          <>
            <span className="text-xs text-muted-foreground">{shown.length} of {rows.length} results</span>
            <Button size="sm" variant="ghost" className="h-8 cursor-pointer" onClick={() => setFilter(NO_FILTER)}>
              <X className="mr-1 h-3.5 w-3.5" /> Clear
            </Button>
          </>
        )}
      </div>

      {shown.length === 0 && (
        <Card className="shadow-none">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">No results match these filters.</CardContent>
        </Card>
      )}

      {[...scales].sort((a, b) => a.scaleName.localeCompare(b.scaleName)).map((sc) => {
        const mine = shown.filter(({ r }) => r.scaleId === sc.id);
        if (mine.length === 0) return null;
        return (
          <section key={sc.id} className="space-y-2">
            <h3 className="text-sm font-bold">{sc.scaleName}</h3>
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