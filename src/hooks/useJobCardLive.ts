// src/hooks/useJobCardLive.ts  
// Live view of one job card: the card, its scales, work items and time entries.
// Each stream is an Amplify observeQuery, the same mechanism the other pages use.
import { useEffect, useState } from "react";
import { client } from "@/services/schema";
import {
  mapJobCard, mapScale, mapTimeEntry, mapWorkItem,
} from "@/services/jobCardTime.service";
import type { JobCard, JobCardScale, TimeEntry, WorkItem } from "@/types/jobcards.types";

type Row = Record<string, unknown>;

export function useJobCardLive(id: string | undefined) {
  const [jobCard, setJobCard] = useState<JobCard | null>(null);
  const [scales, setScales] = useState<JobCardScale[]>([]);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [synced, setSynced] = useState({ jc: false, scales: false, items: false, entries: false });

  useEffect(() => {
    if (!id) return;
    const filter = { jobCardId: { eq: id } };
    const mark = (k: keyof typeof synced) => setSynced((p) => (p[k] ? p : { ...p, [k]: true }));
    const subs = [
      client.models.JobCard.observeQuery({ filter: { id: { eq: id } } }).subscribe({
        next: ({ items: r, isSynced }) => { setJobCard(r[0] ? mapJobCard(r[0] as Row) : null); if (isSynced) mark("jc"); },
        error: (e) => console.error("[jobcard] subscription error", e),
      }),
      client.models.JobCardScale.observeQuery({ filter }).subscribe({
        next: ({ items: r, isSynced }) => { setScales(r.map((x) => mapScale(x as Row))); if (isSynced) mark("scales"); },
        error: (e) => console.error("[jobcard scales] subscription error", e),
      }),
      client.models.JobCardModule.observeQuery({ filter }).subscribe({
        next: ({ items: r, isSynced }) => { setItems(r.map((x) => mapWorkItem(x as Row))); if (isSynced) mark("items"); },
        error: (e) => console.error("[jobcard work items] subscription error", e),
      }),
      client.models.JobCardTimeEntry.observeQuery({ filter }).subscribe({
        next: ({ items: r, isSynced }) => { setEntries(r.map((x) => mapTimeEntry(x as Row))); if (isSynced) mark("entries"); },
        error: (e) => console.error("[jobcard time] subscription error", e),
      }),
    ];
    return () => subs.forEach((x) => x.unsubscribe());
  }, [id]);

  const loading = !(synced.jc && synced.scales && synced.items && synced.entries);
  return { jobCard, scales, items, entries, loading };
}

/** Re-render every second while `active` (used for running timers only). */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}