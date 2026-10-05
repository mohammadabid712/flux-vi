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

type PersistedState = Pick<AppStore, "projects" | "userMedia" | "settings" | "preferences" | "seeded">;

export interface AppStore {
  projects: Project[];
  userMedia: MediaAsset[];
  settings: EditorSettings;
  preferences: Preferences;
  seeded: boolean;
  hasHydrated: boolean;
  pending: PendingEdit | null;

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

        deleteProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),

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

        addUserMedia: (asset) => set((s) => ({ userMedia: [asset, ...s.userMedia] })),

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
  useAppStore((s) => s.projects.find((p) => p.id === id));
