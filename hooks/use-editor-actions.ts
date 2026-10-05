import { useMemo } from "react";
import type { TextPreset } from "@/constants/media";
import { lutById, TransitionPresets } from "@/constants/media";
import { useEditorStore } from "@/store/editor-store";
import type { Clip, FilterPreset, MediaAsset, Track, TransitionType } from "@/store/types";
import { useAppStore } from "@/store/useAppStore";
import { newId } from "@/utils/id";
import {
  accepts,
  activeClipAt,
  appendClip,
  buildClip,
  buildTextClip,
  clipEnd,
  deleteClip,
  findClip,
  MAX_TRACKS,
  nextTrackLabel,
  patchClip,
  resolveOverlaps,
  setClipSpeed,
  splitClip,
  trackColor,
  trimClip,
} from "@/utils/timeline";

export type Notify = (message: string, tone?: "info" | "error" | "success") => void;

const tracksOf = (projectId: string): Track[] =>
  useAppStore.getState().projects.find((p) => p.id === projectId)?.tracks ?? [];

/** Imperative editing commands shared by toolbar, timeline, bins, inspector and hotkeys. */
export function useEditorActions(projectId: string, notify: Notify) {
  return useMemo(() => {
    const app = () => useAppStore.getState();
    const ed = () => useEditorStore.getState();
    const commit = (label: string, fn: (t: Track[]) => Track[]) => {
      app().edit(projectId, label, fn);
      ed().set({ lastAction: label });
    };

    const selectedClip = (): { track: Track; clip: Clip } | null => {
      const id = ed().selectedClipId;
      return id ? findClip(tracksOf(projectId), id) : null;
    };

    const ensureUnlocked = (track: Track | undefined): boolean => {
      if (track?.isLocked) {
        notify(`${track.label} is locked`, "error");
        return false;
      }
      return !!track;
    };

    const splitAt = (clipId: string, time: number) => {
      const found = findClip(tracksOf(projectId), clipId);
      if (!found || !ensureUnlocked(found.track)) return;
      const res = splitClip(tracksOf(projectId), clipId, time);
      if (!res) {
        notify("Move the playhead inside the clip to split", "error");
        return;
      }
      commit("Split Clip", () => res.tracks);
      ed().set({ selectedClipId: res.rightId, selectedTrackId: found.track.id });
    };

    const targetTrack = (clipType: Clip["type"]): Track | undefined => {
      const tracks = tracksOf(projectId);
      const sel = tracks.find((t) => t.id === ed().selectedTrackId);
      if (sel && accepts(sel, clipType) && !sel.isLocked) return sel;
      if (clipType === "audio") return tracks.find((t) => t.type === "audio" && !t.isLocked);
      if (clipType === "text") return tracks.find((t) => t.type === "text" && !t.isLocked);
      return tracks.find((t) => t.type === "video" && !t.isLocked) ?? tracks.find((t) => t.type === "overlay" && !t.isLocked);
    };

    return {
      select: (clipId: string | null, trackId?: string | null) =>
        ed().set({ selectedClipId: clipId, selectedTrackId: trackId ?? ed().selectedTrackId }),

      splitAt,

      splitAtPlayhead: () => {
        const t = ed().currentTime;
        const tracks = tracksOf(projectId);
        const sel = selectedClip();
        if (sel && t > sel.clip.startTime && t < clipEnd(sel.clip)) return splitAt(sel.clip.id, t);
        const track =
          tracks.find((tr) => tr.id === ed().selectedTrackId && activeClipAt(tr, t)) ??
          tracks.find((tr) => tr.type === "video" && !tr.isLocked && activeClipAt(tr, t)) ??
          tracks.find((tr) => !tr.isLocked && activeClipAt(tr, t));
        const clip = track ? activeClipAt(track, t) : undefined;
        if (!clip) {
          notify("No clip under the playhead to split", "error");
          return;
        }
        splitAt(clip.id, t);
      },

      deleteSelected: () => {
        const sel = selectedClip();
        if (!sel) {
          notify("Select a clip to delete", "error");
          return;
        }
        if (!ensureUnlocked(sel.track)) return;
        commit(ed().ripple ? "Ripple Delete" : "Delete Clip", (t) => deleteClip(t, sel.clip.id, ed().ripple));
        ed().set({ selectedClipId: null });
      },

      addAsset: (asset: MediaAsset) => {
        const type: Clip["type"] = asset.type === "audio" ? "audio" : asset.type === "image" ? "image" : "video";
        const track = targetTrack(type);
        if (!track) {
          notify("No unlocked track can accept this media", "error");
          return;
        }
        const clip = buildClip(asset, track, 0);
        commit("Add Clip", (t) => appendClip(t, track.id, clip));
        ed().set({ selectedClipId: clip.id, selectedTrackId: track.id });
        notify(`Added "${asset.name}" to ${track.label}`, "success");
      },

      addText: (preset: TextPreset) => {
        const track = targetTrack("text");
        if (!track) {
          notify("Add or unlock a text track first", "error");
          return;
        }
        const clip = buildTextClip(preset.props, track, ed().currentTime, 5);
        commit("Add Title", (t) =>
          t.map((tr) => (tr.id === track.id ? resolveOverlaps({ ...tr, clips: [...tr.clips, clip] }) : tr)),
        );
        ed().set({ selectedClipId: clip.id, selectedTrackId: track.id });
        notify(`Added "${preset.name}" at playhead`, "success");
      },

      applyLut: (filter: FilterPreset) => {
        const sel = selectedClip();
        if (!sel || (sel.clip.type !== "video" && sel.clip.type !== "image")) {
          notify("Select a video clip to apply a LUT", "error");
          return;
        }
        if (!ensureUnlocked(sel.track)) return;
        commit(`Apply LUT: ${lutById(filter).name}`, (t) => patchClip(t, sel.clip.id, { filter }));
      },

      applyTransition: (transition: TransitionType) => {
        const sel = selectedClip();
        if (!sel || sel.clip.type === "audio" || sel.clip.type === "text") {
          notify("Select a video clip to add a transition", "error");
          return;
        }
        if (!ensureUnlocked(sel.track)) return;
        const name = TransitionPresets.find((p) => p.id === transition)?.name ?? "Transition";
        commit(`Add ${name}`, (t) => patchClip(t, sel.clip.id, { transition }));
      },

      patchSelected: (label: string, patch: Partial<Clip>, mode: "commit" | "live" = "commit") => {
        const sel = selectedClip();
        if (!sel || sel.track.isLocked) return;
        app().edit(projectId, label, (t) => patchClip(t, sel.clip.id, patch), mode);
        if (mode === "commit") ed().set({ lastAction: label });
      },

      endLive: (label: string) => {
        app().endLiveEdit(projectId, label);
        ed().set({ lastAction: label });
      },

      setSpeed: (speed: number) => {
        const sel = selectedClip();
        if (!sel || !ensureUnlocked(sel.track)) return;
        commit("Change Speed", (t) => setClipSpeed(t, sel.clip.id, speed, ed().ripple));
      },

      setInOut: (edge: "in" | "out") => {
        const sel = selectedClip();
        if (!sel) {
          notify("Select a clip to set in/out points", "error");
          return;
        }
        if (!ensureUnlocked(sel.track)) return;
        const t = ed().currentTime;
        const delta = edge === "in" ? t - sel.clip.startTime : t - clipEnd(sel.clip);
        commit(edge === "in" ? "Trim In-Point" : "Trim Out-Point", (tr) => trimClip(tr, sel.clip.id, edge, delta));
      },

      updateTrack: (trackId: string, label: string, patch: Partial<Track>, mode: "commit" | "live" = "commit") => {
        app().edit(projectId, label, (t) => t.map((tr) => (tr.id === trackId ? { ...tr, ...patch } : tr)), mode);
        if (mode === "commit") ed().set({ lastAction: label });
      },

      addTrack: (type: "video" | "audio") => {
        const tracks = tracksOf(projectId);
        if (tracks.length >= MAX_TRACKS) {
          notify(`Projects support up to ${MAX_TRACKS} tracks`, "error");
          return;
        }
        const { label, name } = nextTrackLabel(tracks, type);
        const audioCount = tracks.filter((t) => t.type === "audio").length;
        const track: Track = {
          id: newId(),
          type: type === "video" ? "overlay" : "audio",
          name,
          label,
          order: 0,
          color: type === "video" ? trackColor("overlay") : trackColor("audio", audioCount),
          isMuted: false,
          isLocked: false,
          isSolo: false,
          volume: 1,
          clips: [],
        };
        commit(`Add ${type === "video" ? "Video" : "Audio"} Track`, (t) => {
          const next = type === "video" ? [track, ...t] : [...t, track];
          return next.map((tr, i) => ({ ...tr, order: i }));
        });
        ed().set({ selectedTrackId: track.id, selectedClipId: null });
      },

      undo: () => {
        const label = app().undo(projectId);
        if (!label) {
          notify("Nothing to undo");
          return;
        }
        ed().set({ lastAction: `Undo: ${label}` });
        const sel = ed().selectedClipId;
        if (sel && !findClip(tracksOf(projectId), sel)) ed().set({ selectedClipId: null });
      },

      redo: () => {
        const label = app().redo(projectId);
        if (!label) {
          notify("Nothing to redo");
          return;
        }
        ed().set({ lastAction: `Redo: ${label}` });
        const sel = ed().selectedClipId;
        if (sel && !findClip(tracksOf(projectId), sel)) ed().set({ selectedClipId: null });
      },
    };
  }, [projectId, notify]);
}

export type EditorActions = ReturnType<typeof useEditorActions>;
