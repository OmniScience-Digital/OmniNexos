// src/hooks/useMyTickets.ts
// TICKETING: the signed-in user's tickets for the list under the Task Form.
//
// The backend changes tickets directly in DynamoDB (number, due date, follow-ups, closed), which
// the app's real-time subscriptions cannot see, so this re-reads on a timer instead:
//   - every 5 seconds while a new ticket is still waiting for its number (gives up after WAIT_MS,
//     in case the backend is down; Refresh still works),
//   - otherwise every 20 seconds,
//   - only while the tab is visible, and straight away when the person comes back to the tab.
import { useCallback, useEffect, useRef, useState } from "react";
import { listMyTickets } from "@/services/ticket.service";
import type { TicketSummary } from "@/types/ticket.types";

const FAST_POLL_MS = 5_000;
const LIVE_POLL_MS = 20_000;
export const WAIT_MS = 3 * 60_000;

export function useMyTickets(userId: string | undefined) {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Tickets created in this session. The index is eventually consistent, so a ticket saved a
  // moment ago may be missing from the next read; keep it until the server list has it.
  const justCreated = useRef(new Map<string, TicketSummary>());

  const load = useCallback(
    async (silent = false) => {
      if (!userId) return;
      if (!silent) setLoading(true);
      try {
        const fromServer = await listMyTickets(userId);
        const seen = new Set(fromServer.map((t) => t.id));
        for (const id of seen) justCreated.current.delete(id);
        const merged = [...justCreated.current.values(), ...fromServer].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        );
        setTickets(merged);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const waiting = tickets.some(
    (t) => t.status === "SUBMITTED" && Date.now() - Date.parse(t.createdAt) < WAIT_MS,
  );

  // Live refresh: skip while the tab is hidden, catch up as soon as it is shown again.
  useEffect(() => {
    if (!userId) return;
    const tick = () => {
      if (!document.hidden) void load(true);
    };
    const timer = setInterval(tick, waiting ? FAST_POLL_MS : LIVE_POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [userId, waiting, load]);

  const addCreated = useCallback((ticket: TicketSummary) => {
    justCreated.current.set(ticket.id, ticket);
    setTickets((prev) => [ticket, ...prev.filter((t) => t.id !== ticket.id)]);
  }, []);

  return { tickets, loading, error, refresh: () => load(), addCreated };
}