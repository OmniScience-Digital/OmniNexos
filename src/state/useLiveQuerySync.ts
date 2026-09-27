// src/state/useLiveQuerySync.ts
//
// The per-argument counterpart to sync.ts's global subscriptions, for models
// where only one page reads a given argument (SubCategory filtered by one
// categoryId, Asset filtered by one customerSiteId) — there's no cross-page
// duplication to remove, but this keeps the same architecture (RTK Query
// cache + observeQuery pushing into it) instead of a third, one-off pattern
// of local useState + its own subscription.
//
// Unlike sync.ts, this starts and stops with the page that needs it (mount
// and `arg` changes), since starting every possible categoryId's/
// customerSiteId's subscription at boot would mean subscribing to nearly
// every row in the table individually.
import { useEffect } from "react";
import { api } from "./api";
import { useAppDispatch } from "./store";

export function useLiveQuerySync<TRaw, TMapped>(
  endpointName: string,
  arg: string,
  observe: (
    arg: string,
  ) => { subscribe: (observer: { next: (r: { items: TRaw[]; isSynced: boolean }) => void; error: (e: unknown) => void }) => { unsubscribe(): void } },
  map: (item: TRaw) => TMapped,
) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (!arg) return;
    const sub = observe(arg).subscribe({
      next: ({ items, isSynced }: { items: TRaw[]; isSynced: boolean }) => {
        if (!isSynced) return;
        dispatch(
          api.util.upsertQueryData(endpointName as never, arg as never, (items || []).map(map) as never),
        );
      },
      error: (error: unknown) => {
        console.error(`[sync] ${endpointName}(${arg}) subscription error:`, error);
      },
    });
    return () => sub.unsubscribe();
  }, [dispatch, endpointName, arg, observe, map]);
}
