// src/app/jobcards/components/TimeTrackingPanel.tsx
import { Clock, Play, CheckCircle2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNow } from "@/hooks/useJobCardLive";
import type { TimeEntry, TimeEntryEndReason, WorkItem } from "@/types/jobcards.types";
import {
  allSubmitted, elapsedSpan, entrySeconds, formatDuration, groupSessionsByDay, isOpen, personSeconds, SITE_TIME_ZONE,
  totalsByUser,
} from "@/utils/helper/jobCardTime";

const END_LABEL: Record<TimeEntryEndReason, string> = {
  ALL_SUBMITTED: "Last work item submitted",
  JOB_CLOSED: "Job card closed",
  NO_WORK_ITEMS: "All work items removed",
  SESSION_ENDED: "Left the job card",
  IDLE_TIMEOUT: "No activity (session timed out)",
};

const fmtTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: SITE_TIME_ZONE }) : "-";
const fmtDay = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-ZA", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

const fmt = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "-";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Time tracking for one job card. Read-only on purpose: entries are recorded
 * passively (see src/utils/helper/jobCardTime.ts), so there is nothing to start or stop here.
 */
export default function TimeTrackingPanel({ entries, items }: { entries: TimeEntry[]; items: WorkItem[] }) {
  const running = entries.some(isOpen);
  const now = useNow(running);

  const people = totalsByUser(entries, now);
  const span = elapsedSpan(entries, now);
  const days = groupSessionsByDay(entries, now);
  const done = allSubmitted(items);

  const status = running
    ? { label: "Running", icon: <Play className="size-3" />, variant: "default" as const }
    : entries.length > 0
      ? { label: done ? "Complete" : "Stopped", icon: <CheckCircle2 className="size-3" />, variant: "secondary" as const }
      : { label: "Not started", icon: <Clock className="size-3" />, variant: "outline" as const };

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="size-4 text-muted-foreground" /> Time tracking
        </CardTitle>
        <Badge variant={status.variant}>{status.icon}{status.label}</Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Accumulated time" value={formatDuration(personSeconds(entries, now))} hint={`${days.length} site day${days.length === 1 ? "" : "s"}, all people added together`} />
          <Stat
            label="Elapsed"
            value={span ? formatDuration(span.seconds) : "0 min"}
            hint={span ? `${fmt(span.startedAt)} to ${span.endedAt ? fmt(span.endedAt) : "now"}` : "Starts with the first work item"}
          />
          <Stat label="Users engaged" value={String(people.length)} hint="Tracked separately below" />
        </div>

        {people.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No time recorded yet. Time starts when a user opens the job card and is recorded one session per visit.
          </p>
        ) : (
          <>
            <div>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-medium"><Users className="size-4" /> By user</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Sessions</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {people.map((u) => (
                    <TableRow key={u.userId}>
                      <TableCell className="font-medium">{u.userName}</TableCell>
                      <TableCell className="text-right tabular-nums">{u.sessions}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatDuration(u.seconds)}</TableCell>
                      <TableCell>
                        <Badge variant={u.running ? "default" : "secondary"}>{u.running ? "Running" : "Stopped"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Sessions by site day</h4>
              {days.map((d) => (
                <div key={d.day} className="space-y-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-bold">{fmtDay(d.day)}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatDuration(d.seconds)} · {d.sessions.length} session{d.sessions.length === 1 ? "" : "s"} · {d.people} {d.people === 1 ? "person" : "people"}
                    </p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Ended</TableHead>
                        <TableHead className="text-right">Time</TableHead>
                        <TableHead>Ended because</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.sessions.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>{e.userName || e.userId}</TableCell>
                          <TableCell>{fmtTime(e.startedAt)}</TableCell>
                          <TableCell>{e.endedAt ? fmtTime(e.endedAt) : "Running"}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatDuration(entrySeconds(e, now))}</TableCell>
                          <TableCell className="text-muted-foreground">{e.endReason ? END_LABEL[e.endReason] : "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          </>
        )}
        <p className="text-xs text-muted-foreground">
          Recorded automatically. A session starts when a person opens this job card and ends when they leave it (or after
          a few minutes of no activity). Being assigned a job card does not start time. Several logins of one person
          are counted as one person. Every running session also stops when the last work item is submitted or the job
          card is closed.
        </p>
      </CardContent>
    </Card>
  );
}