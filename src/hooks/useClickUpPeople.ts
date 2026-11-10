// src/hooks/useClickUpPeople.ts
// TICKETING: the people the Task Form offers. Reads the ClickUp members the backend synced and
// merges them with the standard list. If the read fails (or the backend has not synced yet) the
// form still works with the standard list, just without the "ClickUp user" tags.
import { useEffect, useMemo, useState } from "react";
import { listClickUpMembers } from "@/services/ticket.service";
import type { ClickUpMember } from "@/types/ticket.types";
import { buildPeople, latestSync } from "@/utils/helper/ticket";

export function useClickUpPeople() {
  const [members, setMembers] = useState<ClickUpMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listClickUpMembers()
      .then((rows) => {
        if (!cancelled) setMembers(rows);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const people = useMemo(() => buildPeople(members), [members]);
  const syncedAt = useMemo(() => latestSync(members), [members]);
  return { people, syncedAt, loading, failed, hasClickUp: members.length > 0 };
}