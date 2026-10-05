import type { ImageSourcePropType } from "react-native";

export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5";
export type FrameRate = 24 | 30 | 60;
export type TrackType = "video" | "audio" | "text" | "overlay";
export type ClipType = "video" | "audio" | "text" | "image";
export type FilterPreset = "none" | "cinematic" | "cyberpunk" | "warm" | "vintage" | "noir" | "pop";
export type TransitionType = "none" | "dissolve" | "dip" | "zoom" | "whip" | "glitch";
export type TextAnimation = "none" | "fade" | "pop" | "slide" | "typewriter";
export type WaveformDetail = "simple" | "medium" | "detailed";
export type EditorTool = "select" | "blade";

export interface Resolution {
  width: number;
  height: number;
}

export interface ClipTransform {
  scale: number;
  posX: number;
  posY: number;
  opacity: number;
  rotation: number;
}

export interface TextProperties {
  content: string;
  fontSize: number;
  fontColor: string;
  bgColor: string;
  bgEnabled: boolean;
  fontFamily: string;
  animation: TextAnimation;
  style: "lower" | "subtitle" | "title" | "neon";
}

export interface ColorAdjust {
  brightness: number; // -100..100
  contrast: number; // -100..100
  saturation: number; // -100..100
}

export interface Clip {
  id: string;
  trackId: string;
  mediaId: string;
  title: string;
  type: ClipType;
  startTime: number;
  duration: number;
  inPoint: number;
  outPoint: number;
  sourceDuration: number;
  thumbnailUrl: string;
  color: string;
  volume: number; // 0..1.5
  speed: number; // 0.25..4
  reverse: boolean;
  isMuted: boolean;
  fadeIn: number;
  fadeOut: number;
  ducking: boolean;
  filter: FilterPreset;
  adjust: ColorAdjust;
  transition: TransitionType;
  transform: ClipTransform;
  textProperties?: TextProperties;
}

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  label: string; // V1, A2 ...
  order: number;
  color: string;
  isMuted: boolean;
  isLocked: boolean;
  isSolo: boolean;
  volume: number; // 0..2
  clips: Clip[];
}

export interface HistorySnapshot {
  label: string;
  tracks: Track[];
  at: string;
}

export interface Project {
  id: string;
  title: string;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  frameRate: FrameRate;
  duration: number;
  currentTime: number;
  tracks: Track[];
  history: { past: HistorySnapshot[]; future: HistorySnapshot[] };
  coverArt: ArtworkKey;
  createdAt: string;
  updatedAt: string;
}

export type ArtworkKey = "city" | "lake" | "cyber" | "camera" | "laptop" | "mic" | "hiker";

export interface MediaAsset {
  id: string;
  name: string;
  type: "video" | "audio" | "image";
  url: string;
  thumbnailUrl: string;
  artwork?: ArtworkKey;
  duration: number;
  resolution: string;
  fileSize: string;
  category: "sample" | "stock" | "user_upload";
  group?: "music" | "sfx" | "voice";
}

export interface EditorSettings {
  snapTolerance: number;
  rippleDefault: boolean;
  waveformDetail: WaveformDetail;
}

export interface Preferences {
  theme: "dark" | "light";
  projectView: "grid" | "list";
}

export type ArtworkSource = ImageSourcePropType;
