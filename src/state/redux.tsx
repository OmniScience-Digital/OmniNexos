// src/state/redux.tsx
//
// Just the Provider component (see src/state/store.ts for the store itself
// and the typed hooks). The rest of the app wraps this once, at the root
// (see src/App.tsx).
import { startDataSync } from "@/state/sync";
import { store } from "@/state/store";
import { useEffect, type ReactNode } from "react";
import { Provider } from "react-redux";

export default function StoreProvider({ children }: { children: ReactNode }) {
  // Started once, for the lifetime of the app — not per page, which is what
  // caused the duplicated Fleet/Category subscriptions this replaces. No ref
  // guard here on purpose: React 18 StrictMode (dev only) mounts, cleans up,
  // then mounts again, and startDataSync's own returned cleanup already
  // unsubscribes correctly, so the effect can just run every time it's asked
  // to. A ref guard would swallow that second mount and leave the real app
  // with dead subscriptions after the StrictMode cycle.
  useEffect(() => startDataSync(store.dispatch), []);

  return <Provider store={store}>{children}</Provider>;
}
