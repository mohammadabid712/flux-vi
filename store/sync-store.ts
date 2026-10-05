import { create } from "zustand";
import type { Profile, SyncStatus } from "./types";

/** Transient cloud-sync state (not persisted). */
export interface SyncState {
  authReady: boolean;
  status: SyncStatus;
  error: string | null;
  lastSyncedAt: string | null;
  profile: Profile | null;
  profileError: string | null;
  cloudProjectCount: number;
  /** One-shot message for the UI (e.g. guest drafts migrated). */
  notice: string | null;
  set: (patch: Partial<Omit<SyncState, "set">>) => void;
}

export const useSyncStore = create<SyncState>()((set) => ({
  authReady: false,
  status: "local",
  error: null,
  lastSyncedAt: null,
  profile: null,
  profileError: null,
  cloudProjectCount: 0,
  notice: null,
  set: (patch) => set(patch),
}));
