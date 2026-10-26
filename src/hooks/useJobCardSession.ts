// src/hooks/useJobCardSession.ts
// Session-based time tracking for the web app. Being ASSIGNED a job card starts nothing; time starts when a person
// ENTERS the job card, and each visit is its own session, so work on different days or site visits stays apart.
//
//  - on entry: close stale sessions, then start one (unless the card is closed or all its work is already submitted);
//  - while the page is visible: a heartbeat every minute keeps the session alive;
//  - leaving the page ends the session; a closed tab or sleeping laptop is closed later as IDLE_TIMEOUT, at the
//    last heartbeat, by whoever opens the job card next;
//  - coming back to the tab after the session was closed starts a new one.
// Only the person's own web sessions (JOB_CARD_OPENED) are touched. Entries written by the mobile app are left to
// the stop rule.
import { useEffect, useRef } from "react";
import {
  endSession, listTimeEntries, recordEngagement, sweepIdleSessions, touchSession,
} from "@/services/jobCardTime.service";
import type { JobCard, TimeEntry, TimeUser, WorkItem } from "@/types/jobcards.types";
import {
  emailLookup, HEARTBEAT_MS, isOpen, isSamePerson, shouldStartSession,
} from "@/utils/helper/jobCardTime";

interface Args {
  jobCard: JobCard | null;
  items: WorkItem[];
  entries: TimeEntry[];
  user: TimeUser | null;
  /** All live data has arrived (so "no open entry" really means none). */
  ready: boolean;
  /** Only people who work on job cards generate time; someone just viewing one does not. */
  enabled: boolean;
}

export function useJobCardSession({ jobCard, items, entries, user, ready, enabled }: Args) {
  const latest = useRef({ jobCard, items, entries, user });
  // declared before the effect below, so it always runs first and the effect reads current values
  useEffect(() => { latest.current = { jobCard, items, entries, user }; });
  const starting = useRef(false);

  const jobCardId = jobCard?.id;
  const userId = user?.id;
  const active = enabled && ready && !!jobCardId && !!userId;

  useEffect(() => {
    if (!active) return;
    let stopped = false;

    const mySession = () => {
      const { entries: es, user: u } = latest.current;
      if (!u) return undefined;
      const emails = emailLookup(es);
      return es.find((e) => isOpen(e) && e.startReason === "JOB_CARD_OPENED" && isSamePerson(e, u, emails));
    };

    /** Make sure this person has a running session, closing abandoned ones first. */
    const ensureSession = async () => {
      if (starting.current || stopped) return;
      const { jobCard: jc, items: its, user: u } = latest.current;
      if (!jc || !u || jc.status !== "OPEN") return;
      starting.current = true;
      try {
        await sweepIdleSessions(jc.id);
        const fresh = await listTimeEntries(jc.id);
        if (stopped) return;
        if (shouldStartSession({ status: jc.status, items: its, entries: fresh, user: u })) {
          await recordEngagement({ jobCardId: jc.id, user: u, reason: "JOB_CARD_OPENED" });
        }
      } catch (e) {
        console.error("[jobcard] session start failed", e);
      } finally {
        starting.current = false;
      }
    };

    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const mine = mySession();
      try {
        if (mine) {
          await touchSession(mine.id);
          await sweepIdleSessions(mine.jobCardId); // closes other people's abandoned sessions too
        } else {
          await ensureSession(); // e.g. the session was closed while the tab was asleep
        }
      } catch (e) {
        console.error("[jobcard] heartbeat failed", e);
      }
    };

    void ensureSession();
    const timer = setInterval(() => void tick(), HEARTBEAT_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void tick(); };
    document.addEventListener("visibilitychange", onVisible);

    // Best effort when the tab is closed; if it does not complete, the idle sweep closes the session instead.
    const onPageHide = () => { const m = mySession(); if (m) void endSession(m).catch(() => undefined); };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onPageHide);
      const m = mySession(); // leaving the job card ends this visit
      if (m) void endSession(m).catch((e) => console.error("[jobcard] session end failed", e));
    };
  }, [active, jobCardId, userId]);
}