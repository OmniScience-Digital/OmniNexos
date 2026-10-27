// src/app/jobcards/components/AssignJobCard.tsx
// Assign the whole job card to a technician. Assigning only decides who is notified: every technician can still
// open and work on the job card, and assigning does not start any time tracking.
import { useState } from "react";
import { UserCheck } from "lucide-react";
import { useTechnicians } from "@/hooks/useTechnicians";
import { ASSIGN_NEEDS_GROUP, assignJobCard, assignNoticeMessage } from "@/services/jobCardTime.service";
import type { JobCard } from "@/types/jobcards.types";
import TechnicianSelect from "./TechnicianSelect";

interface Props {
  jobCard: JobCard;
  canEdit: boolean;
  onError: (message: string) => void;
}

export default function AssignJobCard({ jobCard, canEdit, onError }: Props) {
  const editable = canEdit && jobCard.status === "OPEN";
  const { technicians, loading, error } = useTechnicians(editable);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // No Telegram group, no assigning. (A job card that is already assigned can still be unassigned.)
  const needsGroup = !jobCard.telegramGroupId;
  const blocked = needsGroup && !jobCard.assignedTo;

  if (!editable) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <UserCheck className="h-3.5 w-3.5" /> Assigned to {jobCard.assignedToName ?? "no one"}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <UserCheck className="h-3.5 w-3.5" /> Assign job card
        </span>
        <TechnicianSelect
          value={jobCard.assignedTo} valueName={jobCard.assignedToName} technicians={technicians} loading={loading}
          disabled={busy || blocked} className="h-8 w-52 text-xs"
          onChange={async (t) => {
            setBusy(true);
            setNotice(null);
            try {
              const result = await assignJobCard(jobCard, t ? { id: t.id, name: t.name, email: t.email } : null);
              if (t) setNotice(assignNoticeMessage(result, t.name));
            } catch (e) {
              onError(e instanceof Error ? e.message : "Could not assign the job card.");
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
      {needsGroup ? (
        <p role="status" className="text-xs text-amber-700 dark:text-amber-300">{ASSIGN_NEEDS_GROUP}</p>
      ) : (
        <p className="text-[11px] text-muted-foreground">Everyone can still open and work on this job card.</p>
      )}
      {error && <p className="text-xs text-destructive">Could not load users ({error}).</p>}
      {notice && (
        <p role="status" className="text-xs text-amber-700 dark:text-amber-300">
          {notice} <button type="button" className="cursor-pointer underline" onClick={() => setNotice(null)}>Dismiss</button>
        </p>
      )}
    </div>
  );
}