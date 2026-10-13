// src/hooks/useJobCardLive.ts 
// Live view of one job card: the card, its scales, work items, time entries, results and certificates.
// Each stream is an Amplify observeQuery, the same mechanism the other pages use.
import { useEffect, useState } from "react";
import { client } from "@/services/schema";
import {
  jobCardBackendReady, mapCertificate, mapJobCard, mapScale, mapSubmission, mapTimeEntry, mapWorkItem,
} from "@/services/jobCardTime.service";
import type { Certificate, JobCard, JobCardScale, Submission, TimeEntry, WorkItem } from "@/types/jobcards.types";

type Row = Record<string, unknown>;
const KEYS = ["jc", "scales", "items", "entries", "results", "certs"] as const;
type Key = (typeof KEYS)[number];

export function useJobCardLive(id: string | undefined) {
  const [jobCard, setJobCard] = useState<JobCard | null>(null);
  const [scales, setScales] = useState<JobCardScale[]>([]);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [results, setResults] = useState<Submission[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [synced, setSynced] = useState<Record<Key, boolean>>({ jc: false, scales: false, items: false, entries: false, results: false, certs: false });

  const unavailable = !jobCardBackendReady();

  useEffect(() => {
    if (!id || !jobCardBackendReady()) return;
    const filter = { jobCardId: { eq: id } };
    const mark = (k: Key) => setSynced((p) => (p[k] ? p : { ...p, [k]: true }));
    const onError = (name: string) => (e: unknown) => console.error(`[jobcard ${name}] subscription error`, e);
    const subs = [
      client.models.JobCard.observeQuery({ filter: { id: { eq: id } } }).subscribe({
        next: ({ items: r, isSynced }) => { setJobCard(r[0] ? mapJobCard(r[0] as Row) : null); if (isSynced) mark("jc"); },
        error: onError("card"),
      }),
      client.models.JobCardScale.observeQuery({ filter }).subscribe({
        next: ({ items: r, isSynced }) => { setScales(r.map((x) => mapScale(x as Row))); if (isSynced) mark("scales"); },
        error: onError("scales"),
      }),
      client.models.JobCardModule.observeQuery({ filter }).subscribe({
        next: ({ items: r, isSynced }) => { setItems(r.map((x) => mapWorkItem(x as Row))); if (isSynced) mark("items"); },
        error: onError("work items"),
      }),
      client.models.JobCardTimeEntry.observeQuery({ filter }).subscribe({
        next: ({ items: r, isSynced }) => { setEntries(r.map((x) => mapTimeEntry(x as Row))); if (isSynced) mark("entries"); },
        error: onError("time"),
      }),
      client.models.JobCardSubmission.observeQuery({ filter }).subscribe({
        next: ({ items: r, isSynced }) => { setResults(r.map((x) => mapSubmission(x as Row))); if (isSynced) mark("results"); },
        error: onError("results"),
      }),
      client.models.CalibrationCertificate.observeQuery({ filter }).subscribe({
        next: ({ items: r, isSynced }) => { setCertificates(r.map((x) => mapCertificate(x as Row))); if (isSynced) mark("certs"); },
        error: onError("certificates"),
      }),
    ];
    return () => subs.forEach((x) => x.unsubscribe());
  }, [id]);

  const loading = !unavailable && !KEYS.every((k) => synced[k]);
  return { jobCard, scales, items, entries, results, certificates, loading, unavailable };
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