// src/state/DataSyncGate.tsx
//
// Starts the global observeQuery subscriptions only while a user is signed
// in, and tears them down on sign-out. Must be rendered inside AuthProvider.
//
// Without this gate the subscriptions opened on the sign-in screen (no JWT)
// and failed with "NoValidAuthTokens: No federated jwt", then never restarted
// after login.
import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { startDataSync } from "@/state/sync";
import { store } from "@/state/store";

export default function DataSyncGate() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    // startDataSync returns its own cleanup, which unsubscribes everything.
    return startDataSync(store.dispatch);
  }, [isAuthenticated, isLoading]);

  return null;
}