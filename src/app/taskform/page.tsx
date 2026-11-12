// src/app/taskform/page.tsx
// TICKETING: the Task Form. Any signed-in user can open it (route: /taskform); it sits next to
// the other forms and uses the same login, no extra permission.
//
// Submitting only saves a SUBMITTED ticket. The backend then gives it its number (T-0001...),
// works out the due date inside business hours, creates the ClickUp task and starts the
// follow-ups. The list under the form shows that happening.
//
// Look and feel: only the site's own components and theme tokens (Card, Select, Avatar, Badge,
// bg-muted / text-primary ...), so it follows light, dark and the blue theme automatically.
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import ManagePeopleDialog from "@/components/ticketing/ManagePeopleDialog";
import PeoplePicker from "@/components/ticketing/PeoplePicker";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { useClickUpPeople } from "@/hooks/useClickUpPeople";
import { useMyTickets, WAIT_MS } from "@/hooks/useMyTickets";
import { createTicket } from "@/services/ticket.service";
import { cn } from "@/lib/utils";
import {
  URGENCY_OPTIONS,
  type TicketFormValues,
  type TicketSummary,
  type UrgencyValue,
} from "@/types/ticket.types";
import {
  BUSINESS_END_HOUR,
  BUSINESS_START_HOUR,
  OUTCOME_MAX,
  TITLE_MAX,
  emptyTicketForm,
  estimateDue,
  formatDue,
  initials,
  isOverdue,
  ticketProgress,
  ticketStatus,
  validateTicketForm,
  type StatusTone,
  type TicketFormErrors,
} from "@/utils/helper/ticket";

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

const TONE_CLASS: Record<StatusTone, string> = {
  info: "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  ok: "border-transparent bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  warn: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  bad: "border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  neutral: "border-transparent bg-secondary text-secondary-foreground",
};

type Filter = "all" | "open" | "closed";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
];
const inFilter = (t: TicketSummary, f: Filter) =>
  f === "all" ||
  (f === "open" ? t.status === "SUBMITTED" || t.status === "OPEN" : t.status === "CLOSED" || t.status === "FAILED");

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive mt-1">
      {message}
    </p>
  );
}

function TicketRowView({ ticket, now }: { ticket: TicketSummary; now: Date }) {
  const stuck = ticket.status === "SUBMITTED" && now.getTime() - Date.parse(ticket.createdAt) >= WAIT_MS;
  const status = ticketStatus(ticket, now);
  const pct = ticketProgress(ticket, now);
  const overdue = isOverdue(ticket, now);
  const shown = ticket.assignees.slice(0, 3);
  const extra = ticket.assignees.length - shown.length;

  return (
    <li className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 border-t py-3 first:border-t-0">
      <span className="font-mono text-xs text-muted-foreground">
        {ticket.ticketNumber ?? "Pending"}
      </span>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium" title={ticket.title}>
          {ticket.title}
        </p>
        {pct !== null && (
          <div
            className="relative mt-2 h-1 rounded-full bg-muted"
            role="img"
            aria-label={`${pct}% of the time used`}
          >
            <div
              className={cn(
                "h-1 rounded-full",
                pct >= 70 ? "bg-destructive" : pct >= 50 ? "bg-amber-500" : "bg-primary",
              )}
              style={{ width: `${pct}%` }}
            />
            <span className="absolute left-1/2 -top-0.5 h-2 w-px bg-border" aria-hidden="true" />
            <span className="absolute left-[70%] -top-0.5 h-2 w-px bg-border" aria-hidden="true" />
          </div>
        )}
        <p className={cn("mt-1 text-xs text-muted-foreground", overdue && "text-destructive")}>
          {ticket.dueAt ? `Due ${formatDue(ticket.dueAt)}` : "Due date set once the task is created"}
          {" · "}
          {ticket.urgency}
          {stuck && " · Taking longer than usual"}
        </p>
      </div>

      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={TONE_CLASS[status.tone]}
            title={ticket.lastError ?? undefined}
          >
            {ticket.status === "SUBMITTED" && !stuck && <Loader2 className="animate-spin" />}
            {status.label}
          </Badge>
          {ticket.clickupTaskUrl && (
            <a
              href={ticket.clickupTaskUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${ticket.ticketNumber ?? "task"} in ClickUp`}
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <AvatarGroup title={ticket.assignees.join(", ")}>
          {shown.map((n) => (
            <Avatar key={n} size="sm">
              <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
                {initials(n)}
              </AvatarFallback>
            </Avatar>
          ))}
          {extra > 0 && <AvatarGroupCount>+{extra}</AvatarGroupCount>}
        </AvatarGroup>
      </div>
    </li>
  );
}

export default function TaskFormPage() {
  const { user } = useAuth();
  const userId: string | undefined = user?.sub;

  const [values, setValues] = useState<TicketFormValues>(emptyTicketForm);
  const [errors, setErrors] = useState<TicketFormErrors>({});
  const [tried, setTried] = useState(false); // show errors only after the first submit attempt
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [manageOpen, setManageOpen] = useState(false);

  // A clock for "overdue" and the progress bars, so they stay right without a refresh.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const { tickets, loading, error: listError, refresh, addCreated } = useMyTickets(userId);
  const {
    people,
    syncedAt,
    loading: peopleLoading,
    hasClickUp,
    members,
    picked,
    usingDefault,
    reload: reloadPeople,
  } = useClickUpPeople();
  const allowed = useMemo(() => people.map((p) => p.value), [people]);

  const update = <K extends keyof TicketFormValues>(key: K, value: TicketFormValues[K]) => {
    const next = { ...values, [key]: value };
    setValues(next);
    setJustSubmitted(false);
    if (tried) setErrors(validateTicketForm(next, allowed));
  };

  const dueIso = values.urgency ? estimateDue(values.urgency, now) : null;
  const dueText = !values.urgency
    ? "Choose an urgency"
    : values.urgency === "ASAP"
      ? "As soon as possible"
      : dueIso
        ? formatDue(dueIso)
        : "-";

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setTried(true);
    const found = validateTicketForm(values, allowed);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (!userId) {
      setSubmitError("Your session has expired. Sign in again and retry.");
      return;
    }

    // ClickUp ids of the picked people who are on ClickUp; the backend prefers these over names.
    const assigneeClickupIds = people
      .filter((p) => p.clickupUserId && values.assignees.includes(p.value))
      .map((p) => p.clickupUserId as string);

    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await createTicket(
        { ...values, assigneeClickupIds },
        { id: userId, name: user?.preferred_username ?? user?.name, email: user?.email },
      );
      addCreated(created);
      setValues(emptyTicketForm());
      setErrors({});
      setTried(false);
      setJustSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "The task could not be saved.");
    } finally {
      setSubmitting(false);
    }
  };

  const shownTickets = tickets.filter((t) => inFilter(t, filter));

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="flex-1 px-2 sm:px-4 mt-25 pb-20">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">Task Form</h1>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => setManageOpen(true)}
            >
              <Users />
              Manage people
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">New task</CardTitle>
              <CardDescription>
                The task is created in ClickUp a few seconds after you submit.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} noValidate className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="task-title">Task title</Label>
                  <Input
                    id="task-title"
                    value={values.title}
                    maxLength={TITLE_MAX + 20}
                    onChange={(e) => update("title", e.target.value)}
                    aria-invalid={Boolean(errors.title)}
                    aria-describedby={errors.title ? "task-title-error" : undefined}
                    placeholder="Short, clear name for the task"
                  />
                  <div className="flex justify-between gap-2">
                    <FieldError id="task-title-error" message={errors.title} />
                    <span
                      className={cn(
                        "ml-auto text-xs text-muted-foreground",
                        values.title.length > TITLE_MAX && "text-destructive",
                      )}
                    >
                      {values.title.length} / {TITLE_MAX}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="task-outcome">Required outcome</Label>
                  <Textarea
                    id="task-outcome"
                    value={values.requiredOutcome}
                    maxLength={OUTCOME_MAX + 200}
                    onChange={(e) => update("requiredOutcome", e.target.value)}
                    aria-invalid={Boolean(errors.requiredOutcome)}
                    aria-describedby={errors.requiredOutcome ? "task-outcome-error" : undefined}
                    placeholder="What must be true when this task is done?"
                    rows={4}
                  />
                  <FieldError id="task-outcome-error" message={errors.requiredOutcome} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="task-urgency">Urgency</Label>
                    <Select
                      value={values.urgency}
                      onValueChange={(v) => update("urgency", v as UrgencyValue)}
                    >
                      <SelectTrigger
                        id="task-urgency"
                        className="w-full"
                        aria-invalid={Boolean(errors.urgency)}
                        aria-describedby={errors.urgency ? "task-urgency-error" : undefined}
                      >
                        <SelectValue placeholder="How soon is it needed?" />
                      </SelectTrigger>
                      <SelectContent>
                        {URGENCY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError id="task-urgency-error" message={errors.urgency} />
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Estimated due</p>
                    <div className="flex min-h-9 items-center gap-2 rounded-md bg-muted px-3 py-2">
                      <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
                      <span className="text-sm font-medium" aria-live="polite">
                        {dueText}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Business hours {hh(BUSINESS_START_HOUR)} to {hh(BUSINESS_END_HOUR)}. The final
                      due date is set when the task is created.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="task-assignees">Assign to</Label>
                  <PeoplePicker
                    id="task-assignees"
                    people={people}
                    selected={values.assignees}
                    onChange={(v) => update("assignees", v)}
                    loading={peopleLoading}
                    hasClickUp={hasClickUp}
                    syncedAt={syncedAt}
                    invalid={Boolean(errors.assignees)}
                    describedBy={errors.assignees ? "task-assignees-error" : undefined}
                  />
                  {usingDefault && !peopleLoading && (
                    <p className="text-xs text-muted-foreground">
                      Showing everyone for now. Use Manage people to choose who appears here.
                    </p>
                  )}
                  <FieldError id="task-assignees-error" message={errors.assignees} />
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Checkbox
                    id="task-mit"
                    checked={values.mit}
                    onCheckedChange={(c) => update("mit", c === true)}
                  />
                  <Label htmlFor="task-mit" className="font-normal cursor-pointer">
                    MIT
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    For reporting only, not sent to ClickUp
                  </span>
                </div>

                {submitError && (
                  <p role="alert" className="text-sm text-destructive">
                    {submitError}
                  </p>
                )}
                {justSubmitted && (
                  <p
                    role="status"
                    className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Task submitted. Its number and due date appear in the list below in a few seconds.
                  </p>
                )}

                <div className="border-t pt-4">
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="animate-spin" />}
                    {submitting ? "Submitting" : "Submit task"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">My tasks</CardTitle>
              <div className="flex items-center gap-1">
                {FILTERS.map((f) => (
                  <Button
                    key={f.value}
                    type="button"
                    size="sm"
                    variant={filter === f.value ? "secondary" : "ghost"}
                    aria-pressed={filter === f.value}
                    onClick={() => setFilter(f.value)}
                  >
                    {f.label}
                  </Button>
                ))}
                <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
                  <RefreshCw className={cn(loading && "animate-spin")} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {listError ? (
                <p role="alert" className="text-sm text-destructive">
                  Could not load your tasks: {listError}
                </p>
              ) : loading && tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">Loading</p>
              ) : tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">You have not submitted any tasks yet.</p>
              ) : shownTickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks in this view.</p>
              ) : (
                <>
                  <ul>
                    {shownTickets.map((t) => (
                      <TicketRowView key={t.id} ticket={t} now={now} />
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground">
                    The bar shows the time used. The two ticks mark the 50% follow-up and the 70%
                    escalation.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />

      <ManagePeopleDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        members={members}
        picked={picked}
        onSaved={() => void reloadPeople()}
      />
    </div>
  );
}