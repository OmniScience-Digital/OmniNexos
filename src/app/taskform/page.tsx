// src/app/taskform/page.tsx
// TICKETING: the Task Form. Any signed-in user can open it (route: /taskform); it sits next to
// the other forms and uses the same login, no extra permission.
//
// Submitting only saves a SUBMITTED ticket. The backend then gives it its number (T-0001...),
// works out the due date inside business hours, creates the ClickUp task and starts the
// follow-ups. The list under the form shows that happening.
import { useState } from "react";
import { CheckCircle2, ClipboardList, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { useMyTickets, WAIT_MS } from "@/hooks/useMyTickets";
import { createTicket } from "@/services/ticket.service";
import { cn } from "@/lib/utils";
import {
  ASSIGNEE_OPTIONS,
  URGENCY_OPTIONS,
  type TicketFormValues,
  type TicketStatus,
  type TicketSummary,
} from "@/types/ticket.types";
import {
  OUTCOME_MAX,
  TITLE_MAX,
  emptyTicketForm,
  formatDue,
  validateTicketForm,
  type TicketFormErrors,
} from "@/utils/helper/ticket";

const STATUS_LABEL: Record<TicketStatus, string> = {
  SUBMITTED: "Creating",
  OPEN: "Open",
  CLOSED: "Closed",
  FAILED: "Failed",
};

const STATUS_VARIANT: Record<TicketStatus, "default" | "secondary" | "destructive" | "outline"> = {
  SUBMITTED: "outline",
  OPEN: "default",
  CLOSED: "secondary",
  FAILED: "destructive",
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive mt-1">
      {message}
    </p>
  );
}

function TicketRowView({ ticket }: { ticket: TicketSummary }) {
  const stuck =
    ticket.status === "SUBMITTED" && Date.now() - Date.parse(ticket.createdAt) >= WAIT_MS;
  return (
    <TableRow>
      <TableCell className="font-medium whitespace-nowrap">
        {ticket.ticketNumber ?? <span className="text-muted-foreground">Pending</span>}
      </TableCell>
      <TableCell className="max-w-[16rem] truncate" title={ticket.title}>
        {ticket.title}
      </TableCell>
      <TableCell className="whitespace-nowrap">{ticket.assignees.join(", ")}</TableCell>
      <TableCell>{ticket.urgency}</TableCell>
      <TableCell className="whitespace-nowrap">{formatDue(ticket.dueAt)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[ticket.status]} title={ticket.lastError ?? undefined}>
            {ticket.status === "SUBMITTED" && !stuck && <Loader2 className="animate-spin" />}
            {STATUS_LABEL[ticket.status]}
          </Badge>
          {stuck && (
            <span className="text-xs text-muted-foreground">Taking longer than usual</span>
          )}
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
      </TableCell>
    </TableRow>
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

  const { tickets, loading, error: listError, refresh, addCreated } = useMyTickets(userId);

  const update = <K extends keyof TicketFormValues>(key: K, value: TicketFormValues[K]) => {
    const next = { ...values, [key]: value };
    setValues(next);
    setJustSubmitted(false);
    if (tried) setErrors(validateTicketForm(next));
  };

  const toggleAssignee = (name: string, on: boolean) =>
    update(
      "assignees",
      on ? [...values.assignees, name] : values.assignees.filter((n) => n !== name),
    );

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setTried(true);
    const found = validateTicketForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (!userId) {
      setSubmitError("Your session has expired. Sign in again and retry.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await createTicket(values, {
        id: userId,
        name: user?.preferred_username ?? user?.name,
        email: user?.email,
      });
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

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="flex-1 px-2 sm:px-4 mt-25 pb-20">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">Task Form</h1>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">New task</CardTitle>
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
                  <FieldError id="task-title-error" message={errors.title} />
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

                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium mb-2">Urgency</legend>
                  <div
                    role="radiogroup"
                    aria-label="Urgency"
                    aria-describedby={errors.urgency ? "task-urgency-error" : undefined}
                    className="flex flex-wrap gap-2"
                  >
                    {URGENCY_OPTIONS.map((o) => {
                      const checked = values.urgency === o.value;
                      return (
                        <label
                          key={o.value}
                          className={cn(
                            "cursor-pointer rounded-md border px-3 py-2 text-sm transition-colors focus-within:ring-[3px] focus-within:ring-ring/50",
                            checked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "hover:bg-muted",
                          )}
                        >
                          <input
                            type="radio"
                            name="urgency"
                            value={o.value}
                            checked={checked}
                            onChange={() => update("urgency", o.value)}
                            className="sr-only"
                          />
                          {o.label}
                        </label>
                      );
                    })}
                  </div>
                  <FieldError id="task-urgency-error" message={errors.urgency} />
                </fieldset>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium mb-2">Assignee</legend>
                  <div
                    className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3"
                    aria-describedby={errors.assignees ? "task-assignees-error" : undefined}
                  >
                    {ASSIGNEE_OPTIONS.map((name) => {
                      const id = `assignee-${name}`;
                      return (
                        <div key={name} className="flex items-center gap-2">
                          <Checkbox
                            id={id}
                            checked={values.assignees.includes(name)}
                            onCheckedChange={(c) => toggleAssignee(name, c === true)}
                          />
                          <Label htmlFor={id} className="font-normal cursor-pointer">
                            {name}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                  <FieldError id="task-assignees-error" message={errors.assignees} />
                </fieldset>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="task-mit"
                    checked={values.mit}
                    onCheckedChange={(c) => update("mit", c === true)}
                  />
                  <Label htmlFor="task-mit" className="font-normal cursor-pointer">
                    MIT
                  </Label>
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

                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="animate-spin" />}
                  {submitting ? "Submitting" : "Submit task"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">My tasks</CardTitle>
              <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
                <RefreshCw className={cn(loading && "animate-spin")} />
                Refresh
              </Button>
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
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Assigned to</TableHead>
                        <TableHead>Urgency</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tickets.map((t) => (
                        <TicketRowView key={t.id} ticket={t} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}