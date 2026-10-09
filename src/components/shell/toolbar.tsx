import type { ReactNode, ComponentProps } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Search + filters row. One per page; replaces per-card search boxes. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mb-4 flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

export function SearchField({ className, ...props }: ComponentProps<typeof Input>) {
  return (
    <div className={cn("relative min-w-60 flex-1", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="pl-9" {...props} />
    </div>
  );
}

/** Bordered surface for a table; handles horizontal overflow on small screens. */
export function TableSurface({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-lg border border-border bg-card">{children}</div>;
}

export function TableFooter({ summary, children }: { summary: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-3 text-sm text-muted-foreground">
      <span>{summary}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
