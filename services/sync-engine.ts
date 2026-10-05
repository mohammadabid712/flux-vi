import { AppState, type AppStateStatus } from "react-native";
import { useAppStore } from "@/store/useAppStore";
import { useSyncStore } from "@/store/sync-store";
import {
  deleteRemoteProject,
  ensureProfile,
  errorMessage,
  fetchMedia,
  fetchProfile,
  fetchProjects,
  pushProject,
} from "./cloud";

const DEBOUNCE_MS = 1500;
const RETRY_MS = 10_000;

interface SessionUser {
  id: string;
  email: string | null;
  displayName: string | null;
}

/**
 * Module-level sync engine. `accountRev` increments on every account change so
 * any request started for a previous account is discarded when it resolves.
 */
let accountRev = 0;
let userId: string | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<void> | null = null;
let rerunFull: boolean | null = null;
let unsubscribeStore: (() => void) | null = null;
let appStateSub: { remove: () => void } | null = null;

const sync = useSyncStore.getState;

function clearTimers() {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (retryTimer) clearTimeout(retryTimer);
  debounceTimer = null;
  retryTimer = null;
}

function dirtyProjects(uid: string) {
  const { projects, cloudVersions } = useAppStore.getState();
  return projects.filter((p) => p.ownerId === uid && cloudVersions[p.id] !== p.updatedAt);
}

function hasWork(uid: string) {
  const st = useAppStore.getState();
  return dirtyProjects(uid).length > 0 || st.pendingRemoteDeletes.some((d) => d.ownerId === uid);
}

function countCloud(uid: string) {
  const { projects, cloudVersions } = useAppStore.getState();
  return projects.filter((p) => p.ownerId === uid && cloudVersions[p.id]).length;
}

async function runSync(full: boolean): Promise<void> {
  const uid = userId;
  const rev = accountRev;
  if (!uid) return;
  const stale = () => rev !== accountRev;
  sync().set({ status: "syncing", error: null });
  try {
    // 1. Deletions made offline / while a request was in flight.
    for (const d of useAppStore.getState().pendingRemoteDeletes.filter((x) => x.ownerId === uid)) {
      await deleteRemoteProject(d.id);
      if (stale()) return;
      useAppStore.getState().resolveRemoteDelete(d.id);
    }

    // 2. Pull: last-write-wins merge with the full authorized cloud list.
    if (full) {
      const [remote, media, profile] = await Promise.all([fetchProjects(), fetchMedia(), fetchProfile(uid)]);
      if (stale()) return;
      useAppStore.getState().mergeRemoteProjects(uid, remote);
      useAppStore.getState().mergeCloudMedia(uid, media);
      sync().set({ profile, profileError: null });
    }

    // 3. Push local edits. Projects still being dragged are retried after the gesture.
    let deferred = false;
    for (const p of dirtyProjects(uid)) {
      if (useAppStore.getState().pending?.projectId === p.id) {
        deferred = true;
        continue;
      }
      const res = await pushProject(p, uid);
      if (stale()) return;
      if (res.kind === "pushed") {
        useAppStore.getState().markSynced(p.id, res.updatedAt);
      } else {
        const remote = res.project;
        useAppStore.setState((s) => ({
          projects: s.projects.map((x) =>
            x.id === remote.id ? { ...remote, currentTime: Math.min(x.currentTime, remote.duration), history: x.history } : x,
          ),
          cloudVersions: { ...s.cloudVersions, [remote.id]: remote.updatedAt },
        }));
      }
    }

    if (stale()) return;
    const stillDirty = deferred || hasWork(uid);
    sync().set({
      status: stillDirty ? "pending" : "saved",
      lastSyncedAt: new Date().toISOString(),
      cloudProjectCount: countCloud(uid),
      error: null,
    });
    if (stillDirty) scheduleSync();
  } catch (e) {
    console.error("Cloud sync failed", e);
    if (stale()) return;
    sync().set({ status: "offline", error: errorMessage(e, "Cloud sync failed") });
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void syncNow(true);
    }, RETRY_MS);
  }
}

/** Runs a sync now; concurrent calls are coalesced into one follow-up run. */
export function syncNow(full = true): Promise<void> {
  if (!userId) return Promise.resolve();
  if (inFlight) {
    rerunFull = (rerunFull ?? false) || full;
    return inFlight;
  }
  inFlight = runSync(full).finally(() => {
    inFlight = null;
    const again = rerunFull;
    rerunFull = null;
    if (again !== null && userId) void syncNow(again);
  });
  return inFlight;
}

/** Debounced push (1.5s after the last edit). */
export function scheduleSync() {
  if (!userId) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void syncNow(false);
  }, DEBOUNCE_MS);
}

/** Pushes all pending edits immediately (used before sign-out and export). */
export async function flushSync(): Promise<boolean> {
  if (!userId) return false;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = null;
  await syncNow(false);
  if (inFlight) await inFlight;
  return !hasWork(userId) && sync().status !== "offline";
}

export async function refreshProfile(): Promise<void> {
  const uid = userId;
  const rev = accountRev;
  if (!uid) return;
  try {
    const profile = await fetchProfile(uid);
    if (rev === accountRev) sync().set({ profile, profileError: null });
  } catch (e) {
    console.error("Profile refresh failed", e);
    if (rev === accountRev) sync().set({ profileError: errorMessage(e, "Could not load profile") });
  }
}

function onStoreChange() {
  if (!userId) return;
  if (hasWork(userId)) {
    if (sync().status !== "syncing") sync().set({ status: "pending" });
    scheduleSync();
  }
}

function onAppState(next: AppStateStatus) {
  if (next === "active" && userId) void syncNow(true);
}

export async function startSession(user: SessionUser): Promise<void> {
  if (userId === user.id) return;
  accountRev += 1;
  const rev = accountRev;
  clearTimers();
  userId = user.id;
  const app = useAppStore.getState();
  app.setActiveOwner(user.id);
  const moved = app.claimGuestDrafts(user.id);
  sync().set({
    status: "syncing",
    error: null,
    profile: null,
    profileError: null,
    notice: moved > 0 ? `${moved} local draft${moved === 1 ? "" : "s"} moved to your cloud account` : null,
  });

  unsubscribeStore?.();
  unsubscribeStore = useAppStore.subscribe((s, prev) => {
    if (s.projects !== prev.projects || s.pendingRemoteDeletes !== prev.pendingRemoteDeletes || s.pending !== prev.pending) {
      onStoreChange();
    }
  });
  appStateSub?.remove();
  appStateSub = AppState.addEventListener("change", onAppState);

  try {
    await ensureProfile(user.id, user.email, user.displayName);
  } catch (e) {
    console.error("Could not ensure profile", e);
    if (rev === accountRev) sync().set({ profileError: errorMessage(e, "Could not create profile") });
  }
  if (rev !== accountRev) return;
  await syncNow(true);
}

export function endSession() {
  accountRev += 1;
  clearTimers();
  userId = null;
  unsubscribeStore?.();
  unsubscribeStore = null;
  appStateSub?.remove();
  appStateSub = null;
  useAppStore.getState().setActiveOwner(null);
  sync().set({ status: "local", error: null, profile: null, profileError: null, cloudProjectCount: 0, lastSyncedAt: null });
}

export const currentUserId = () => userId;
