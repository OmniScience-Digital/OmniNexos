// src/hooks/useTechnicians.ts  (NEW FILE)
import { useEffect, useState } from "react";
import { listTechnicians } from "@/services/jobCardTime.service";
import type { Technician } from "@/types/jobcards.types";

/** System login users who can be assigned work. Only loads when `enabled` (i.e. the user can assign). */
export function useTechnicians(enabled: boolean) {
  const [state, setState] = useState<{ list: Technician[] | null; error: string | null }>({ list: null, error: null });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    listTechnicians()
      .then((list:any) => { if (!cancelled) setState({ list, error: null }); })
      .catch((e:any) => {
        console.error("[technicians] load failed", e);
        if (!cancelled) setState({ list: [], error: e instanceof Error ? e.message : "Could not load users." });
      });
    return () => { cancelled = true; };
  }, [enabled]);

  return { technicians: state.list ?? [], loading: enabled && state.list === null, error: state.error };
}