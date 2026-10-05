import type { ImageSourcePropType } from "react-native";
import type {
  ArtworkKey,
  FilterPreset,
  MediaAsset,
  TextProperties,
  TransitionType,
} from "@/store/types";

export const Artwork: Record<ArtworkKey, ImageSourcePropType> = {
  city: require("@/assets/design/artwork-city-night-skyline-3e73848a.jpg"),
  lake: require("@/assets/design/artwork-mountain-lake-landscape-60798045.jpg"),
  cyber: require("@/assets/design/artwork-cyberpunk-tokyo-street-0445f012.jpg"),
  camera: require("@/assets/design/artwork-camera-gear-rig-d95dbc4c.jpg"),
  laptop: require("@/assets/design/artwork-laptop-desk-setup-d4510387.jpg"),
  mic: require("@/assets/design/artwork-studio-microphone-a51c93c6.jpg"),
  hiker: require("@/assets/design/artwork-mountain-hiker-clean.jpg"),
};

export const SampleMedia: MediaAsset[] = [
  { id: "m-city", name: "Neon City Night", type: "video", url: "", thumbnailUrl: "", artwork: "city", duration: 30, resolution: "3840x2160", fileSize: "184 MB", category: "sample" },
  { id: "m-lake", name: "Mountain Drone", type: "video", url: "", thumbnailUrl: "", artwork: "lake", duration: 45, resolution: "3840x2160", fileSize: "262 MB", category: "sample" },
  { id: "m-cyber", name: "Neon Walk", type: "video", url: "", thumbnailUrl: "", artwork: "cyber", duration: 40, resolution: "3840x2160", fileSize: "231 MB", category: "sample" },
  { id: "m-camera", name: "Tech B-Roll", type: "video", url: "", thumbnailUrl: "", artwork: "camera", duration: 20, resolution: "1920x1080", fileSize: "58 MB", category: "stock" },
  { id: "m-laptop", name: "Desk Setup", type: "video", url: "", thumbnailUrl: "", artwork: "laptop", duration: 25, resolution: "1920x1080", fileSize: "71 MB", category: "stock" },
  { id: "m-mic", name: "Studio Mic", type: "video", url: "", thumbnailUrl: "", artwork: "mic", duration: 30, resolution: "1920x1080", fileSize: "86 MB", category: "stock" },
  { id: "m-hiker", name: "Sunrise Hike", type: "video", url: "", thumbnailUrl: "", artwork: "hiker", duration: 30, resolution: "1080x1920", fileSize: "92 MB", category: "stock" },
];

export const SampleAudio: MediaAsset[] = [
  { id: "a-lofi", name: "Lo-Fi Chill Beat", type: "audio", url: "", thumbnailUrl: "", duration: 90, resolution: "48kHz", fileSize: "3.4 MB", category: "stock", group: "music" },
  { id: "a-synth", name: "Cinematic Synth", type: "audio", url: "", thumbnailUrl: "", duration: 120, resolution: "48kHz", fileSize: "4.6 MB", category: "stock", group: "music" },
  { id: "a-electro", name: "Upbeat Electro", type: "audio", url: "", thumbnailUrl: "", duration: 75, resolution: "48kHz", fileSize: "2.9 MB", category: "stock", group: "music" },
  { id: "a-voice", name: "Voiceover Take 3", type: "audio", url: "", thumbnailUrl: "", duration: 60, resolution: "48kHz", fileSize: "2.2 MB", category: "sample", group: "voice" },
  { id: "a-whoosh", name: "Whoosh SFX", type: "audio", url: "", thumbnailUrl: "", duration: 1.5, resolution: "48kHz", fileSize: "64 KB", category: "stock", group: "sfx" },
  { id: "a-click", name: "Click SFX", type: "audio", url: "", thumbnailUrl: "", duration: 0.5, resolution: "48kHz", fileSize: "22 KB", category: "stock", group: "sfx" },
];

export interface TextPreset {
  id: string;
  name: string;
  description: string;
  props: TextProperties;
}

export const TextPresets: TextPreset[] = [
  { id: "t-lower", name: "Lower Third", description: "Name & role bar", props: { content: "Alex Rivera · Creator", fontSize: 28, fontColor: "#F8FAFC", bgColor: "#6366F1", bgEnabled: true, fontFamily: "Plus Jakarta Sans", animation: "slide", style: "lower" } },
  { id: "t-sub", name: "Minimal Subtitle", description: "Clean caption line", props: { content: "Welcome back to the channel", fontSize: 24, fontColor: "#FFFFFF", bgColor: "#000000", bgEnabled: true, fontFamily: "Plus Jakarta Sans", animation: "fade", style: "subtitle" } },
  { id: "t-title", name: "Big Bold Title", description: "Hero title card", props: { content: "TOKYO VLOG", fontSize: 48, fontColor: "#FFFFFF", bgColor: "#8B5CF6", bgEnabled: false, fontFamily: "Plus Jakarta Sans", animation: "pop", style: "title" } },
  { id: "t-neon", name: "Neon Caption", description: "Glowing cyber text", props: { content: "Good Vibes", fontSize: 36, fontColor: "#22D3EE", bgColor: "#000000", bgEnabled: false, fontFamily: "JetBrains Mono", animation: "typewriter", style: "neon" } },
];

export interface LutPreset {
  id: FilterPreset;
  name: string;
  tint: string; // overlay tint for preview compositing
  tintOpacity: number;
  css: string; // CSS filter (web / Android)
  swatch: [string, string];
}

export const LutPresets: LutPreset[] = [
  { id: "none", name: "Original", tint: "transparent", tintOpacity: 0, css: "", swatch: ["#334155", "#64748B"] },
  { id: "cinematic", name: "Cinematic Teal & Orange", tint: "#0EA5A4", tintOpacity: 0.22, css: "contrast(1.18) saturate(1.25) hue-rotate(-8deg)", swatch: ["#0E7490", "#F97316"] },
  { id: "cyberpunk", name: "Cyberpunk Neon", tint: "#D946EF", tintOpacity: 0.24, css: "contrast(1.2) saturate(1.6) hue-rotate(18deg)", swatch: ["#7C3AED", "#EC4899"] },
  { id: "warm", name: "Warm Sunset", tint: "#F97316", tintOpacity: 0.2, css: "saturate(1.2) sepia(0.25) brightness(1.04)", swatch: ["#F59E0B", "#EF4444"] },
  { id: "vintage", name: "Vintage 90s VHS", tint: "#A16207", tintOpacity: 0.22, css: "sepia(0.45) contrast(0.92) saturate(0.85)", swatch: ["#A16207", "#78716C"] },
  { id: "noir", name: "B&W High Contrast", tint: "#000000", tintOpacity: 0.12, css: "grayscale(1) contrast(1.45)", swatch: ["#0A0A0A", "#E5E5E5"] },
  { id: "pop", name: "Clean Pop", tint: "#38BDF8", tintOpacity: 0.08, css: "saturate(1.45) brightness(1.08)", swatch: ["#38BDF8", "#FACC15"] },
];

export const lutById = (id: FilterPreset): LutPreset =>
  LutPresets.find((l) => l.id === id) ?? LutPresets[0];

export interface TransitionPreset {
  id: TransitionType;
  name: string;
  icon: "swap-horizontal" | "contrast" | "expand" | "flash" | "pulse" | "close-circle-outline";
}

export const TransitionPresets: TransitionPreset[] = [
  { id: "dissolve", name: "Cross Dissolve", icon: "swap-horizontal" },
  { id: "dip", name: "Dip to Black", icon: "contrast" },
  { id: "zoom", name: "Zoom In", icon: "expand" },
  { id: "whip", name: "Whip Pan", icon: "flash" },
  { id: "glitch", name: "Glitch", icon: "pulse" },
  { id: "none", name: "No Transition", icon: "close-circle-outline" },
];

export const TRANSITION_SECONDS = 0.6;

export const findMedia = (id: string, extra: MediaAsset[] = []): MediaAsset | undefined =>
  [...SampleMedia, ...SampleAudio, ...extra].find((m) => m.id === id);
