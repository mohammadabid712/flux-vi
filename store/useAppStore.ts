import { useMemo } from "react";
import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  ArtworkKey,
  AspectRatio,
  EditorSettings,
  FrameRate,
  MediaAsset,
  Preferences,
  Project,
  Track,
} from "./types";
import { createSeedProjects, resolutionFor } from "./seed";
import { SampleAudio, SampleMedia } from "@/constants/media";
import { newId } from "@/utils/id";
import { appendClip, buildClip, createDefaultTracks, projectDuration } from "@/utils/timeline";

const PERSISTED_HISTORY = 25;
const WRITE_DELAY_MS = 500;

/**
 * AsyncStorage adapter that coalesces writes: live drags and slider scrubs
 * update state many times per second, so serialisation is deferred and only
 * the latest snapshot is written.
 */
function createDebouncedStorage<S>(): PersistStorage<S> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let queued: { name: string; value: StorageValue<S> } | null = null;
  const flush = async () => {
    timer = null;
    const job = queued;
    queued = null;
    if (!job) return;
    try {
      await AsyncStorage.setItem(job.name, JSON.stringify(job.value));
    } catch (e) {
      console.error("Autosave failed", e);
    }
  };
  return {
    getItem: async (name) => {
      try {
        const raw = await AsyncStorage.getItem(name);
        return raw ? (JSON.parse(raw) as StorageValue<S>) : null;
      } catch (e) {
        console.error("Could not read saved projects", e);
        return null;
      }
    },
    setItem: (name, value) => {
      queued = { name, value };
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, WRITE_DELAY_MS);
    },
    removeItem: async (name) => {
      try {
        await AsyncStorage.removeItem(name);
      } catch (e) {
        console.error("Could not clear saved projects", e);
      }
    },
  };
}

export interface NewProjectInput {
  title: string;
  aspectRatio: AspectRatio;
  frameRate: FrameRate;
  height?: number;
  starterMediaIds: string[];
  cover?: ArtworkKey;
}

type EditMode = "commit" | "live";

interface PendingEdit {
  projectId: string;
  snapshot: Track[];
}

type PersistedState = Pick<
  AppStore,
  "projects" | "userMedia" | "settings" | "preferences" | "seeded" | "cloudVersions" | "deletedIds" | "pendingRemoteDeletes"
>;

export interface RemoteDelete {
  id: string;
  ownerId: string;
}

const MAX_TOMBSTONES = 500;

export interface AppStore {
  projects: Project[];
  userMedia: MediaAsset[];
  settings: EditorSettings;
  preferences: Preferences;
  seeded: boolean;
  hasHydrated: boolean;
  pending: PendingEdit | null;
  /** Signed-in user whose projects are visible; null = guest mode. */
  activeOwnerId: string | null;
  /** projectId -> updatedAt last confirmed in the cloud. */
  cloudVersions: Record<string, string>;
  /** Locally deleted project ids, so stale cloud snapshots can't resurrect them. */
  deletedIds: string[];
  /** Cloud deletions not yet acknowledged by the server (offline). */
  pendingRemoteDeletes: RemoteDelete[];

  ensureSeed: () => void;
  createProject: (input: NewProjectInput) => string;
  duplicateProject: (id: string) => string | null;
  deleteProject: (id: string) => void;
  renameProject: (id: string, title: string) => void;
  setProjectFormat: (id: string, aspectRatio: AspectRatio) => void;
  setCurrentTime: (id: string, time: number) => void;
  edit: (projectId: string, label: string, fn: (tracks: Track[]) => Track[], mode?: EditMode) => void;
  endLiveEdit: (projectId: string, label: string) => void;
  undo: (projectId: string) => string | null;
  redo: (projectId: string) => string | null;
  addUserMedia: (asset: MediaAsset) => void;
  updateSettings: (patch: Partial<EditorSettings>) => void;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;

  setActiveOwner: (ownerId: string | null) => void;
  markSynced: (id: string, updatedAt: string) => void;
  /** Last-write-wins merge of the owner's complete cloud project list. */
  mergeRemoteProjects: (ownerId: string, remote: Project[]) => void;
  /** Move guest drafts and guest imports into the given account. Returns moved project count. */
  claimGuestDrafts: (ownerId: string) => number;
  /** Remove cached projects/media for an account (sign-out without cache retention). */
  clearOwnerCache: (ownerId: string) => void;
  mergeCloudMedia: (ownerId: string, assets: MediaAsset[]) => void;
  removeUserMedia: (id: string) => void;
  resolveRemoteDelete: (id: string) => void;
}

const now = () => new Date().toISOString();

const withTracks = (p: Project, tracks: Track[]): Project => ({
  ...p,
  tracks,
  duration: projectDuration(tracks),
  currentTime: Math.min(p.currentTime, Math.max(projectDuration(tracks), 0)),
  updatedAt: now(),
});

const coverFor = (ids: string[]): ArtworkKey =>
  SampleMedia.find((m) => ids.includes(m.id))?.artwork ?? "city";

export const useAppStore = create<AppStore>()(
  persist<AppStore, [], [], PersistedState>(
    (set, get) => {
      const mapProject = (id: string, fn: (p: Project) => Project) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? fn(p) : p)) }));

      return {
        projects: [],
        userMedia: [],
        settings: { snapTolerance: 8, rippleDefault: false, waveformDetail: "medium" },
        preferences: { theme: "dark", projectView: "grid" },
        seeded: false,
        hasHydrated: false,
        pending: null,
        activeOwnerId: null,
        cloudVersions: {},
        deletedIds: [],
        pendingRemoteDeletes: [],

        ensureSeed: () => {
          if (get().seeded) return;
          set({ projects: createSeedProjects(), seeded: true });
        },

        createProject: (input) => {
          let tracks = createDefaultTracks();
          for (const mediaId of input.starterMediaIds) {
            const asset = [...SampleMedia, ...SampleAudio, ...get().userMedia].find((m) => m.id === mediaId);
            if (!asset) continue;
            const target =
              asset.type === "audio"
                ? tracks.find((t) => t.type === "audio")
                : tracks.find((t) => t.type === "video");
            if (!target) continue;
            const current = tracks.find((t) => t.id === target.id) ?? target;
            tracks = appendClip(tracks, target.id, buildClip(asset, current, 0));
          }
          const id = newId();
          const project: Project = {
            id,
            title: input.title.trim() || "Untitled Project",
            aspectRatio: input.aspectRatio,
            resolution: resolutionFor(input.aspectRatio, input.height ?? 1080),
            frameRate: input.frameRate,
            duration: projectDuration(tracks),
            currentTime: 0,
            tracks,
            history: { past: [], future: [] },
            coverArt: input.cover ?? coverFor(input.starterMediaIds),
            createdAt: now(),
            updatedAt: now(),
            ownerId: get().activeOwnerId,
          };
          set((s) => ({ projects: [project, ...s.projects] }));
          return id;
        },

        duplicateProject: (id) => {
          const src = get().projects.find((p) => p.id === id);
          if (!src) return null;
          const copyId = newId();
          const tracks = src.tracks.map((t) => {
            const trackId = newId();
            return { ...t, id: trackId, clips: t.clips.map((c) => ({ ...c, id: newId(), trackId })) };
          });
          const copy: Project = {
            ...src,
            id: copyId,
            title: `${src.title} (Copy)`,
            tracks,
            history: { past: [], future: [] },
            createdAt: now(),
            updatedAt: now(),
          };
          set((s) => {
            const idx = s.projects.findIndex((p) => p.id === id);
            const next = [...s.projects];
            next.splice(idx + 1, 0, copy);
            return { projects: next };
          });
          return copyId;
        },

        deleteProject: (id) =>
          set((s) => {
            const target = s.projects.find((p) => p.id === id);
            const ownerId = target?.ownerId;
            const { [id]: _removed, ...cloudVersions } = s.cloudVersions;
            return {
              projects: s.projects.filter((p) => p.id !== id),
              deletedIds: [...s.deletedIds.filter((d) => d !== id), id].slice(-MAX_TOMBSTONES),
              cloudVersions,
              pendingRemoteDeletes: ownerId
                ? [...s.pendingRemoteDeletes.filter((d) => d.id !== id), { id, ownerId }]
                : s.pendingRemoteDeletes,
            };
          }),

        renameProject: (id, title) =>
          mapProject(id, (p) => ({ ...p, title: title.trim() || p.title, updatedAt: now() })),

        setProjectFormat: (id, aspectRatio) =>
          mapProject(id, (p) => ({
            ...p,
            aspectRatio,
            resolution: resolutionFor(aspectRatio, Math.min(p.resolution.width, p.resolution.height)),
            updatedAt: now(),
          })),

        setCurrentTime: (id, time) =>
          mapProject(id, (p) => ({ ...p, currentTime: Math.max(0, Math.min(time, p.duration)) })),

        edit: (projectId, label, fn, mode = "commit") => {
          const project = get().projects.find((p) => p.id === projectId);
          if (!project) return;
          const nextTracks = fn(project.tracks);
          if (nextTracks === project.tracks) return;
          if (mode === "live") {
            const pending = get().pending;
            set({
              pending: pending && pending.projectId === projectId ? pending : { projectId, snapshot: project.tracks },
            });
            mapProject(projectId, (p) => withTracks(p, nextTracks));
            return;
          }
          const pending = get().pending;
          const snapshot = pending && pending.projectId === projectId ? pending.snapshot : project.tracks;
          set({ pending: null });
          mapProject(projectId, (p) => ({
            ...withTracks(p, nextTracks),
            history: { past: [...p.history.past, { label, tracks: snapshot, at: now() }], future: [] },
          }));
        },

        endLiveEdit: (projectId, label) => {
          const pending = get().pending;
          if (!pending || pending.projectId !== projectId) return;
          set({ pending: null });
          mapProject(projectId, (p) =>
            p.tracks === pending.snapshot
              ? p
              : { ...p, history: { past: [...p.history.past, { label, tracks: pending.snapshot, at: now() }], future: [] } },
          );
        },

        undo: (projectId) => {
          const project = get().projects.find((p) => p.id === projectId);
          const last = project?.history.past.at(-1);
          if (!project || !last) return null;
          mapProject(projectId, (p) => ({
            ...withTracks(p, last.tracks),
            history: {
              past: p.history.past.slice(0, -1),
              future: [...p.history.future, { label: last.label, tracks: p.tracks, at: now() }],
            },
          }));
          return last.label;
        },

        redo: (projectId) => {
          const project = get().projects.find((p) => p.id === projectId);
          const next = project?.history.future.at(-1);
          if (!project || !next) return null;
          mapProject(projectId, (p) => ({
            ...withTracks(p, next.tracks),
            history: {
              past: [...p.history.past, { label: next.label, tracks: p.tracks, at: now() }],
              future: p.history.future.slice(0, -1),
            },
          }));
          return next.label;
        },

        addUserMedia: (asset) =>
          set((s) => ({
            userMedia: [{ ...asset, ownerId: asset.ownerId ?? s.activeOwnerId }, ...s.userMedia.filter((m) => m.id !== asset.id)],
          })),

        removeUserMedia: (id) => set((s) => ({ userMedia: s.userMedia.filter((m) => m.id !== id) })),

        setActiveOwner: (ownerId) => {
          if (get().activeOwnerId !== ownerId) set({ activeOwnerId: ownerId });
        },

        markSynced: (id, updatedAt) => set((s) => ({ cloudVersions: { ...s.cloudVersions, [id]: updatedAt } })),

        mergeRemoteProjects: (ownerId, remote) =>
          set((s) => {
            const deleted = new Set(s.deletedIds);
            const remoteById = new Map(remote.map((r) => [r.id, r]));
            const cloudVersions = { ...s.cloudVersions };
            const next: Project[] = [];
            for (const local of s.projects) {
              if (local.ownerId !== ownerId) {
                next.push(local);
                continue;
              }
              const r = remoteById.get(local.id);
              if (!r) {
                // Previously confirmed in the cloud but now gone: deleted on another device.
                if (cloudVersions[local.id]) delete cloudVersions[local.id];
                else next.push(local); // never uploaded yet; the sync engine will push it
                continue;
              }
              remoteById.delete(local.id);
              const dirty = cloudVersions[local.id] !== local.updatedAt;
              if (dirty && local.updatedAt >= r.updatedAt) {
                next.push(local); // local edit is newer — keep it, it will be pushed
              } else if (r.updatedAt === local.updatedAt) {
                next.push(local);
                cloudVersions[local.id] = r.updatedAt;
              } else {
                next.push({ ...r, currentTime: Math.min(local.currentTime, r.duration), history: local.history });
                cloudVersions[local.id] = r.updatedAt;
              }
            }
            for (const r of remoteById.values()) {
              if (deleted.has(r.id)) continue;
              next.push(r);
              cloudVersions[r.id] = r.updatedAt;
            }
            return { projects: next, cloudVersions };
          }),

        claimGuestDrafts: (ownerId) => {
          let moved = 0;
          set((s) => ({
            projects: s.projects.map((p) => {
              // Untouched bundled samples stay on the device instead of being copied into every account.
              if (p.ownerId || p.sampleUpdatedAt === p.updatedAt) return p;
              moved += 1;
              return { ...p, ownerId, updatedAt: now() };
            }),
            userMedia: s.userMedia.map((m) => (m.ownerId ? m : { ...m, ownerId })),
          }));
          return moved;
        },

        clearOwnerCache: (ownerId) =>
          set((s) => {
            const cloudVersions = { ...s.cloudVersions };
            for (const p of s.projects) if (p.ownerId === ownerId) delete cloudVersions[p.id];
            return {
              projects: s.projects.filter((p) => p.ownerId !== ownerId),
              userMedia: s.userMedia.filter((m) => m.ownerId !== ownerId),
              cloudVersions,
            };
          }),

        mergeCloudMedia: (ownerId, assets) =>
          set((s) => {
            const ids = new Set(assets.map((a) => a.id));
            const kept = s.userMedia.filter((m) => !ids.has(m.id) && !(m.ownerId === ownerId && m.cloudId));
            return { userMedia: [...assets, ...kept] };
          }),

        resolveRemoteDelete: (id) =>
          set((s) => ({ pendingRemoteDeletes: s.pendingRemoteDeletes.filter((d) => d.id !== id) })),

        updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

        setPreference: (key, value) => set((s) => ({ preferences: { ...s.preferences, [key]: value } })),
      };
    },
    {
      name: "veloce-studio-v1",
      storage: createDebouncedStorage<PersistedState>(),
      partialize: (state) => ({
        projects: state.projects.map((p) => ({
          ...p,
          history: {
            past: p.history.past.slice(-PERSISTED_HISTORY),
            future: p.history.future.slice(-PERSISTED_HISTORY),
          },
        })),
        userMedia: state.userMedia,
        settings: state.settings,
        preferences: state.preferences,
        seeded: state.seeded,
        cloudVersions: state.cloudVersions,
        deletedIds: state.deletedIds,
        pendingRemoteDeletes: state.pendingRemoteDeletes,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) console.error("Failed to restore saved projects", error);
        useAppStore.setState({ hasHydrated: true });
        if (!state?.seeded) useAppStore.getState().ensureSeed();
      },
    },
  ),
);

export const useProject = (id: string | undefined): Project | undefined =>
  useAppStore((s) => s.projects.find((p) => p.id === id && (p.ownerId ?? null) === s.activeOwnerId));

/** A project or media item belongs to the active account (or to guest mode when signed out). */
export const isVisibleTo = (ownerId: string | null | undefined, active: string | null): boolean =>
  (ownerId ?? null) === active;

/** Projects belonging to the active account (or guest drafts when signed out). */
export function useVisibleProjects(): Project[] {
  const projects = useAppStore((s) => s.projects);
  const active = useAppStore((s) => s.activeOwnerId);
  return useMemo(() => projects.filter((p) => isVisibleTo(p.ownerId, active)), [projects, active]);
}

/** Uploaded media visible to the active account. Guest imports are visible only in guest mode. */
export function useVisibleMedia(): MediaAsset[] {
  const media = useAppStore((s) => s.userMedia);
  const active = useAppStore((s) => s.activeOwnerId);
  return useMemo(() => media.filter((m) => isVisibleTo(m.ownerId, active)), [media, active]);
}
