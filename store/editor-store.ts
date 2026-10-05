import { create } from "zustand";
import type { EditorTool } from "./types";

/** Transient, non-persisted editor session state (high-frequency playhead lives here). */
export interface EditorState {
  currentTime: number;
  isPlaying: boolean;
  rate: number; // negative = rewind (J), >1 = fast-forward (L)
  speedPreset: 1 | 1.5 | 2;
  loop: boolean;
  zoom: number;
  snap: boolean;
  ripple: boolean;
  tool: EditorTool;
  showGuides: boolean;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  lastAction: string | null;
  set: (patch: Partial<Omit<EditorState, "set" | "reset">>) => void;
  reset: (patch: Partial<Omit<EditorState, "set" | "reset">>) => void;
}

const initial = {
  currentTime: 0,
  isPlaying: false,
  rate: 1,
  speedPreset: 1 as const,
  loop: false,
  zoom: 1,
  snap: true,
  ripple: false,
  tool: "select" as EditorTool,
  showGuides: false,
  selectedClipId: null,
  selectedTrackId: null,
  lastAction: null,
};

export const useEditorStore = create<EditorState>()((set) => ({
  ...initial,
  set: (patch) => set(patch),
  reset: (patch) => set({ ...initial, ...patch }),
}));
