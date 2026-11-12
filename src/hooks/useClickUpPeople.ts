// src/hooks/useClickUpPeople.ts
// TICKETING: the people the Task Form offers.
//
// Once someone has set up the reusable list ("Manage people"), the dropdown offers ONLY the people on
// that list. Until then (a fresh install) it falls back to the old behaviour, the standard names plus
// every ClickUp member, so the form is never empty. `usingDefault` tells the page which one it is.
// If a read fails the form still works, just without the "ClickUp user" tags.
import { useCallback, useEffect, useMemo, useState } from "react";
import { listClickUpMembers, listPickedPeople } from "@/services/ticket.service";
import type { ClickUpMember, PickedPerson } from "@/types/ticket.types";
import { buildPeople, latestSync } from "@/utils/helper/ticket";
import { buildPickerPeople } from "@/utils/helper/ticketPeople";

export function useClickUpPeople() {
  const [members, setMembers] = useState<ClickUpMember[]>([]);
  const [picked, setPicked] = useState<PickedPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const [m, p] = await Promise.allSettled([listClickUpMembers(), listPickedPeople()]);
    setMembers(m.status === "fulfilled" ? m.value : []);
    setPicked(p.status === "fulfilled" ? p.value : []);
    setFailed(m.status === "rejected");
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([listClickUpMembers(), listPickedPeople()]).then(([m, p]) => {
      if (cancelled) return;
      setMembers(m.status === "fulfilled" ? m.value : []);
      setPicked(p.status === "fulfilled" ? p.value : []);
      setFailed(m.status === "rejected");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const usingDefault = picked.length === 0;
  const people = useMemo(
    () => (usingDefault ? buildPeople(members) : buildPickerPeople(picked, members)),
    [usingDefault, members, picked],
  );
  const syncedAt = useMemo(() => latestSync(members), [members]);
  return {
    people,
    syncedAt,
    loading,
    failed,
    hasClickUp: members.length > 0,
    members,
    picked,
    usingDefault,
    reload: load,
  };
}