// src/hooks/useMyTickets.ts
// TICKETING: the signed-in user's tickets for the list under the Task Form.
//
// A new ticket starts as SUBMITTED and the backend gives it a number a few seconds later,
// so while any ticket is still waiting we re-read every few seconds. If the backend is
// down the waiting ticket would stay SUBMITTED forever, so auto-refresh gives up after
// WAIT_MS and the person can still press Refresh.
import { useCallback, useEffect, useRef, useState } from "react";
import { listMyTickets } from "@/services/ticket.service";
import type { TicketSummary } from "@/types/ticket.types";

const POLL_MS = 5_000;
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

  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => void load(true), POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, load]);

  const addCreated = useCallback((ticket: TicketSummary) => {
    justCreated.current.set(ticket.id, ticket);
    setTickets((prev) => [ticket, ...prev.filter((t) => t.id !== ticket.id)]);
  }, []);

  return { tickets, loading, error, refresh: () => load(), addCreated };
}