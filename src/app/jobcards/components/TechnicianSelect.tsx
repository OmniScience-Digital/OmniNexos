// src/app/jobcards/components/TechnicianSelect.tsx  (NEW FILE)
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Technician } from "@/types/jobcards.types";

const NONE = "__none__";

interface Props {
  value: string | null | undefined;
  /** Name stored on the work item, shown if that user is no longer in the list (disabled or removed). */
  valueName?: string | null;
  technicians: Technician[];
  onChange: (technician: Technician | null) => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  placeholder?: string;
}

/** Pick a technician (a system login user), or leave the work unassigned. */
export default function TechnicianSelect({
  value, valueName, technicians, onChange, disabled, loading, className, placeholder = "Unassigned",
}: Props) {
  const current = value ?? NONE;
  const known = current === NONE || technicians.some((t) => t.id === current);
  return (
    <Select
      value={current}
      disabled={disabled || loading}
      onValueChange={(v) => onChange(v === NONE ? null : technicians.find((t) => t.id === v) ?? null)}
    >
      <SelectTrigger className={className ?? "h-8 w-52 text-xs"}>
        <SelectValue placeholder={loading ? "Loading users..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Unassigned</SelectItem>
        {technicians.map((t) => (
          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
        ))}
        {!known && <SelectItem value={current}>{(valueName || "Unknown user") + " (no longer listed)"}</SelectItem>}
      </SelectContent>
    </Select>
  );
}