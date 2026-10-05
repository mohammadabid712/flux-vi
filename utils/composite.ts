import { TRANSITION_SECONDS } from "@/constants/media";
import type { Clip, Track } from "@/store/types";
import { activeClipAt } from "@/utils/timeline";

export interface VisualLayer {
  clip: Clip;
  trackId: string;
  sourceTime: number;
  progress: number;
  kenScale: number;
  kenX: number;
  kenY: number;
  opacity: number;
  extraScale: number;
  offsetX: number;
  dip: number; // 0..1 black overlay
  glitch: number; // 0..1
}

export interface TextLayer {
  clip: Clip;
  progress: number;
  opacity: number;
  translateY: number;
  scale: number;
  visibleChars: number;
}

export interface Frame {
  visuals: VisualLayer[];
  texts: TextLayer[];
}

const hashSeed = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
};

/** Deterministic pseudo-amplitude (0..1) for waveform drawing and meters. */
export function amplitude(seedKey: string, t: number): number {
  const seed = hashSeed(seedKey) * 100;
  const a =
    0.45 * Math.abs(Math.sin(t * 2.1 + seed)) +
    0.3 * Math.abs(Math.sin(t * 7.3 + seed * 1.7)) +
    0.25 * Math.abs(Math.sin(t * 13.9 + seed * 0.3));
  const env = 0.55 + 0.45 * Math.sin(t * 0.35 + seed);
  return Math.max(0.06, Math.min(1, a * env));
}

const isVisible = (tracks: Track[], kind: "visual" | "audio") => {
  const pool = tracks.filter((t) => (kind === "audio" ? t.type === "audio" : t.type !== "audio"));
  const anySolo = pool.some((t) => t.isSolo);
  return pool.filter((t) => !t.isMuted && (!anySolo || t.isSolo));
};

export function sourceTimeOf(clip: Clip, t: number): number {
  const local = Math.max(0, t - clip.startTime) * clip.speed;
  return clip.reverse ? clip.outPoint - local : clip.inPoint + local;
}

export function computeFrame(tracks: Track[], t: number): Frame {
  const visuals: VisualLayer[] = [];
  const texts: TextLayer[] = [];
  const visible = isVisible(tracks, "visual");
  // tracks are ordered top → bottom; composite bottom → top
  for (let i = visible.length - 1; i >= 0; i--) {
    const track = visible[i];
    const clip = activeClipAt(track, t);
    if (!clip) continue;
    const local = t - clip.startTime;
    const progress = clip.duration > 0 ? local / clip.duration : 0;
    if (track.type === "text") {
      const props = clip.textProperties;
      const anim = props?.animation ?? "fade";
      const inP = Math.min(1, local / 0.5);
      const outP = Math.min(1, (clip.duration - local) / 0.4);
      const fade = Math.max(0, Math.min(inP, outP));
      texts.push({
        clip,
        progress,
        opacity: (anim === "none" ? 1 : fade) * clip.transform.opacity,
        translateY: anim === "slide" ? (1 - inP) * 24 : 0,
        scale: anim === "pop" ? 0.7 + 0.3 * Math.min(1, inP * 1.2) + (inP < 1 ? 0.06 * Math.sin(inP * Math.PI) : 0) : 1,
        visibleChars:
          anim === "typewriter"
            ? Math.ceil((props?.content.length ?? 0) * Math.min(1, local / Math.max(0.6, clip.duration * 0.4)))
            : (props?.content.length ?? 0),
      });
      continue;
    }
    const src = sourceTimeOf(clip, t);
    const srcRatio = clip.sourceDuration > 0 ? src / Math.min(clip.sourceDuration, 120) : 0;
    const tr = clip.transition !== "none" && local < TRANSITION_SECONDS ? local / TRANSITION_SECONDS : 1;
    let opacity = clip.transform.opacity;
    let extraScale = 1;
    let offsetX = 0;
    let dip = 0;
    let glitch = 0;
    switch (clip.transition) {
      case "dissolve":
        opacity *= tr;
        break;
      case "dip":
        dip = 1 - tr;
        break;
      case "zoom":
        extraScale = 1 + (1 - tr) * 0.35;
        opacity *= Math.min(1, tr * 1.5);
        break;
      case "whip":
        offsetX = (1 - tr) ** 2 * 0.9;
        break;
      case "glitch":
        glitch = tr < 1 ? 1 - tr : 0;
        break;
      default:
        break;
    }
    visuals.push({
      clip,
      trackId: track.id,
      sourceTime: src,
      progress,
      kenScale: 1.06 + 0.1 * (srcRatio % 1),
      kenX: Math.sin(src * 0.08) * 0.025,
      kenY: Math.cos(src * 0.06) * 0.015,
      opacity,
      extraScale,
      offsetX,
      dip,
      glitch,
    });
  }
  return { visuals, texts };
}

export interface AudioLevel {
  trackId: string;
  level: number; // 0..1 post-fader
}

export function computeAudio(tracks: Track[], t: number): AudioLevel[] {
  const audible = isVisible(tracks, "audio");
  const voiceActive = audible.some((tr) => tr.label === "A1" && activeClipAt(tr, t));
  return tracks
    .filter((tr) => tr.type === "audio")
    .map((tr) => {
      if (!audible.includes(tr)) return { trackId: tr.id, level: 0 };
      const clip = activeClipAt(tr, t);
      if (!clip || clip.isMuted) return { trackId: tr.id, level: 0 };
      const local = t - clip.startTime;
      let gain = clip.volume * tr.volume;
      if (clip.fadeIn > 0) gain *= Math.min(1, local / clip.fadeIn);
      if (clip.fadeOut > 0) gain *= Math.min(1, (clip.duration - local) / clip.fadeOut);
      if (clip.ducking && voiceActive && tr.label !== "A1") gain *= 0.35;
      return { trackId: tr.id, level: Math.min(1, amplitude(clip.mediaId, sourceTimeOf(clip, t)) * gain) };
    });
}

/** CSS filter string for a clip's LUT + manual adjustments. */
export function cssFilterFor(clip: Clip, lutCss: string): string {
  const { brightness, contrast, saturation } = clip.adjust;
  const parts = [lutCss];
  if (brightness !== 0) parts.push(`brightness(${(1 + brightness / 100).toFixed(2)})`);
  if (contrast !== 0) parts.push(`contrast(${(1 + contrast / 100).toFixed(2)})`);
  if (saturation !== 0) parts.push(`saturate(${(1 + saturation / 100).toFixed(2)})`);
  return parts.filter(Boolean).join(" ");
}
