import type { ArtworkKey, AspectRatio, FrameRate } from "@/store/types";

export interface QuickPreset {
  id: string;
  name: string;
  spec: string;
  aspectRatio: AspectRatio;
  height: number;
  frameRate: FrameRate;
  artwork: ArtworkKey;
  badge: "youtube" | "tiktok" | "instagram" | "vlog" | "podcast";
  starterMediaIds: string[];
  defaultTitle: string;
}

export const QuickPresets: QuickPreset[] = [
  { id: "yt", name: "YouTube", spec: "16:9 4K", aspectRatio: "16:9", height: 2160, frameRate: 60, artwork: "city", badge: "youtube", starterMediaIds: [], defaultTitle: "YouTube Video" },
  { id: "tt", name: "TikTok / Reels", spec: "9:16", aspectRatio: "9:16", height: 1080, frameRate: 60, artwork: "cyber", badge: "tiktok", starterMediaIds: [], defaultTitle: "Vertical Short" },
  { id: "ig", name: "Instagram", spec: "1:1", aspectRatio: "1:1", height: 1080, frameRate: 30, artwork: "lake", badge: "instagram", starterMediaIds: [], defaultTitle: "Instagram Post" },
  { id: "vlog", name: "Vlog Template", spec: "16:9", aspectRatio: "16:9", height: 1080, frameRate: 30, artwork: "hiker", badge: "vlog", starterMediaIds: ["m-hiker", "m-lake", "a-lofi"], defaultTitle: "Weekend Vlog" },
  { id: "pod", name: "Podcast Video Clip", spec: "16:9", aspectRatio: "16:9", height: 1080, frameRate: 30, artwork: "mic", badge: "podcast", starterMediaIds: ["m-mic", "a-voice"], defaultTitle: "Podcast Clip" },
];

export const AspectOptions: { value: AspectRatio; label: string; hint: string }[] = [
  { value: "16:9", label: "16:9", hint: "Widescreen" },
  { value: "9:16", label: "9:16", hint: "Vertical" },
  { value: "1:1", label: "1:1", hint: "Square" },
  { value: "4:5", label: "4:5", hint: "Portrait" },
];

export const aspectName = (ar: AspectRatio): string =>
  ({ "16:9": "16:9 Widescreen", "9:16": "9:16 Vertical", "1:1": "1:1 Square", "4:5": "4:5 Portrait" })[ar];

export const aspectValue = (ar: AspectRatio): number =>
  ({ "16:9": 16 / 9, "9:16": 9 / 16, "1:1": 1, "4:5": 4 / 5 })[ar];

export const resolutionLabel = (w: number, h: number): string => {
  const short = Math.min(w, h);
  if (short >= 2160) return "4K";
  if (short >= 1440) return "1440p";
  if (short >= 1080) return "1080p";
  return `${short}p`;
};
