import { useAuth } from "@fastshot/auth";
import { useEffect } from "react";
import { endSession, startSession } from "@/services/sync-engine";
import { useAppStore } from "@/store/useAppStore";
import { useSyncStore } from "@/store/sync-store";

/** Bridges the Supabase auth session to the cloud sync engine. Renders nothing. */
export function CloudSession() {
  const { user, isInitializing } = useAuth();
  const hydrated = useAppStore((s) => s.hasHydrated);
  const userId = user?.id ?? null;
  const email = user?.email ?? null;
  const meta = user?.user_metadata as { display_name?: unknown; full_name?: unknown } | undefined;
  const displayName =
    typeof meta?.display_name === "string" ? meta.display_name : typeof meta?.full_name === "string" ? meta.full_name : null;

  useEffect(() => {
    // Wait for persisted projects so guest-draft migration sees the real local data.
    if (isInitializing || !hydrated) return;
    useSyncStore.getState().set({ authReady: true });
    if (userId) {
      startSession({ id: userId, email, displayName }).catch((e: unknown) => console.error("Cloud session failed", e));
    } else {
      endSession();
    }
  }, [isInitializing, hydrated, userId, email, displayName]);

  return null;
}
