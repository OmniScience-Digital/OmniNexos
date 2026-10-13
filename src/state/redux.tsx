// src/state/redux.tsx
//
// Just the Provider component (see src/state/store.ts for the store itself
// and the typed hooks). The rest of the app wraps this once, at the root
// (see src/App.tsx).
//
// Live data sync is NOT started here. It needs a signed-in user (every model
// uses userPool auth), and this provider sits above AuthProvider. See
// src/state/DataSyncGate.tsx, which starts/stops startDataSync based on auth.
import { store } from "@/state/store";
import type { ReactNode } from "react";
import { Provider } from "react-redux";

export default function StoreProvider({ children }: { children: ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}