import type { Clip, MediaAsset, TextProperties, Track, TrackType } from "@/store/types";
import { newId } from "@/utils/id";

export const MIN_CLIP = 0.25;
export const TEXT_SOURCE = 3600;
export const MAX_TRACKS = 8;

const round = (n: number) => Math.round(n * 1000) / 1000;

export const TrackColors: Record<string, string> = {
  overlay: "#8B5CF6",
  video: "#3B82F6",
  text: "#F59E0B",
  audio1: "#10B981",
  audio2: "#14B8A6",
};

export function trackColor(type: TrackType, audioIndex = 0): string {
  if (type === "audio") return audioIndex % 2 === 0 ? TrackColors.audio1 : TrackColors.audio2;
  return TrackColors[type];
}

export function createDefaultTracks(): Track[] {
  const base = (type: TrackType, name: string, label: string, order: number, color: string): Track => ({
    id: newId(),
    type,
    name,
    label,
    order,
    color,
    isMuted: false,
    isLocked: false,
    isSolo: false,
    volume: 1,
    clips: [],
  });
  return [
    base("overlay", "Overlays / B-Roll", "V2", 0, TrackColors.overlay),
    base("video", "Main Footage", "V1", 1, TrackColors.video),
    base("text", "Titles & Text", "T1", 2, TrackColors.text),
    base("audio", "Voice / Audio", "A1", 3, TrackColors.audio1),
    base("audio", "Music & SFX", "A2", 4, TrackColors.audio2),
  ];
}

export const clipEnd = (c: Clip) => c.startTime + c.duration;

export function projectDuration(tracks: Track[]): number {
  let max = 0;
  for (const t of tracks) for (const c of t.clips) max = Math.max(max, clipEnd(c));
  return round(max);
}

export const trackEnd = (t: Track): number => t.clips.reduce((m, c) => Math.max(m, clipEnd(c)), 0);

export const findClip = (tracks: Track[], clipId: string): { track: Track; clip: Clip } | null => {
  for (const track of tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { track, clip };
  }
  return null;
};

/** Accepts clip type on track type. */
export function accepts(track: Track, clipType: Clip["type"]): boolean {
  if (track.type === "audio") return clipType === "audio";
  if (track.type === "text") return clipType === "text";
  return clipType === "video" || clipType === "image";
}

/** Sorts clips and pushes any overlapping clip to the right (magnetic layering). */
export function resolveOverlaps(track: Track): Track {
  const sorted = [...track.clips].sort((a, b) => a.startTime - b.startTime);
  let cursor = 0;
  const clips = sorted.map((c) => {
    const start = Math.max(c.startTime, cursor);
    cursor = start + c.duration;
    return start === c.startTime ? c : { ...c, startTime: round(start) };
  });
  return { ...track, clips };
}

const updateTrack = (tracks: Track[], trackId: string, fn: (t: Track) => Track): Track[] =>
  tracks.map((t) => (t.id === trackId ? fn(t) : t));

export function buildClip(
  asset: MediaAsset,
  track: Track,
  startTime: number,
): Clip {
  const type: Clip["type"] = asset.type === "audio" ? "audio" : asset.type === "image" ? "image" : "video";
  const source = type === "image" ? TEXT_SOURCE : asset.duration;
  const duration = type === "image" ? 5 : asset.duration;
  return {
    id: newId(),
    trackId: track.id,
    mediaId: asset.id,
    title: asset.name,
    type,
    startTime: round(startTime),
    duration,
    inPoint: 0,
    outPoint: duration,
    sourceDuration: source,
    thumbnailUrl: asset.thumbnailUrl,
    color: track.color,
    volume: 1,
    speed: 1,
    reverse: false,
    isMuted: false,
    fadeIn: 0,
    fadeOut: 0,
    ducking: false,
    filter: "none",
    adjust: { brightness: 0, contrast: 0, saturation: 0 },
    transition: "none",
    transform: { scale: 1, posX: 0, posY: 0, opacity: 1, rotation: 0 },
  };
}

export function buildTextClip(props: TextProperties, track: Track, startTime: number, duration = 5): Clip {
  return {
    id: newId(),
    trackId: track.id,
    mediaId: "text",
    title: props.content,
    type: "text",
    startTime: round(startTime),
    duration,
    inPoint: 0,
    outPoint: duration,
    sourceDuration: TEXT_SOURCE,
    thumbnailUrl: "",
    color: track.color,
    volume: 1,
    speed: 1,
    reverse: false,
    isMuted: false,
    fadeIn: 0,
    fadeOut: 0,
    ducking: false,
    filter: "none",
    adjust: { brightness: 0, contrast: 0, saturation: 0 },
    transition: "none",
    transform: { scale: 1, posX: 0, posY: 0, opacity: 1, rotation: 0 },
    textProperties: { ...props },
  };
}

export function appendClip(tracks: Track[], trackId: string, clip: Clip): Track[] {
  return updateTrack(tracks, trackId, (t) => ({
    ...t,
    clips: [...t.clips, { ...clip, trackId, color: t.color, startTime: round(trackEnd(t)) }],
  }));
}

/** Splits a clip at an absolute timeline time. Returns null when the cut is outside the clip. */
export function splitClip(tracks: Track[], clipId: string, time: number): { tracks: Track[]; rightId: string } | null {
  const found = findClip(tracks, clipId);
  if (!found) return null;
  const { clip, track } = found;
  const offset = time - clip.startTime;
  if (offset < MIN_CLIP / 2 || clip.duration - offset < MIN_CLIP / 2) return null;
  const sourceCut = clip.inPoint + offset * clip.speed;
  const left: Clip = { ...clip, duration: round(offset), outPoint: round(sourceCut), fadeOut: 0 };
  const right: Clip = {
    ...clip,
    id: newId(),
    startTime: round(time),
    duration: round(clip.duration - offset),
    inPoint: round(sourceCut),
    fadeIn: 0,
    transition: "none",
  };
  const next = updateTrack(tracks, track.id, (t) => ({
    ...t,
    clips: t.clips.flatMap((c) => (c.id === clipId ? [left, right] : [c])),
  }));
  return { tracks: next, rightId: right.id };
}

/** Trims the head ("in") or tail ("out") of a clip by a timeline delta (seconds). */
export function trimClip(tracks: Track[], clipId: string, edge: "in" | "out", delta: number): Track[] {
  const found = findClip(tracks, clipId);
  if (!found) return tracks;
  const { clip, track } = found;
  const prevEnd = track.clips
    .filter((c) => c.id !== clipId && clipEnd(c) <= clip.startTime + 0.001)
    .reduce((m, c) => Math.max(m, clipEnd(c)), 0);
  let next: Clip;
  if (edge === "in") {
    const minDelta = Math.max(-clip.inPoint / clip.speed, prevEnd - clip.startTime);
    const maxDelta = clip.duration - MIN_CLIP;
    const d = Math.min(maxDelta, Math.max(minDelta, delta));
    next = {
      ...clip,
      startTime: round(clip.startTime + d),
      duration: round(clip.duration - d),
      inPoint: round(clip.inPoint + d * clip.speed),
    };
  } else {
    const maxDelta = (clip.sourceDuration - clip.outPoint) / clip.speed;
    const minDelta = MIN_CLIP - clip.duration;
    const d = Math.min(maxDelta, Math.max(minDelta, delta));
    next = {
      ...clip,
      duration: round(clip.duration + d),
      outPoint: round(clip.outPoint + d * clip.speed),
    };
  }
  return updateTrack(tracks, track.id, (t) =>
    resolveOverlaps({ ...t, clips: t.clips.map((c) => (c.id === clipId ? next : c)) }),
  );
}

/** Moves a clip in time, optionally onto another compatible track. */
export function moveClip(tracks: Track[], clipId: string, newStart: number, targetTrackId?: string): Track[] {
  const found = findClip(tracks, clipId);
  if (!found) return tracks;
  const { clip, track } = found;
  const target = tracks.find((t) => t.id === (targetTrackId ?? track.id));
  const dest = target && !target.isLocked && accepts(target, clip.type) ? target : track;
  const moved: Clip = { ...clip, trackId: dest.id, color: dest.color, startTime: round(Math.max(0, newStart)) };
  return tracks.map((t) => {
    let clips = t.clips.filter((c) => c.id !== clipId);
    if (t.id === dest.id) {
      // A clip already covering the drop point keeps its place; later clips are pushed right.
      const covering = clips.find((c) => c.startTime < moved.startTime && clipEnd(c) > moved.startTime + 0.001);
      const placed = covering ? { ...moved, startTime: round(clipEnd(covering)) } : moved;
      clips = [...clips, placed];
      return resolveOverlaps({ ...t, clips });
    }
    return t.id === track.id ? { ...t, clips } : t;
  });
}

export function deleteClip(tracks: Track[], clipId: string, ripple: boolean): Track[] {
  const found = findClip(tracks, clipId);
  if (!found) return tracks;
  const { clip, track } = found;
  return updateTrack(tracks, track.id, (t) => ({
    ...t,
    clips: t.clips
      .filter((c) => c.id !== clipId)
      .map((c) =>
        ripple && c.startTime >= clipEnd(clip) - 0.001 ? { ...c, startTime: round(c.startTime - clip.duration) } : c,
      ),
  }));
}

/** Changes playback speed and recalculates the clip's timeline duration. */
export function setClipSpeed(tracks: Track[], clipId: string, speed: number, ripple: boolean): Track[] {
  const found = findClip(tracks, clipId);
  if (!found) return tracks;
  const { clip, track } = found;
  const duration = round((clip.outPoint - clip.inPoint) / speed);
  const delta = duration - clip.duration;
  return updateTrack(tracks, track.id, (t) =>
    resolveOverlaps({
      ...t,
      clips: t.clips.map((c) => {
        if (c.id === clipId) return { ...c, speed, duration };
        if (ripple && c.startTime >= clipEnd(clip) - 0.001) return { ...c, startTime: round(Math.max(0, c.startTime + delta)) };
        return c;
      }),
    }),
  );
}

export function patchClip(tracks: Track[], clipId: string, patch: Partial<Clip>): Track[] {
  return tracks.map((t) =>
    t.clips.some((c) => c.id === clipId)
      ? { ...t, clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)) }
      : t,
  );
}

export const activeClipAt = (track: Track, time: number): Clip | undefined =>
  track.clips.find((c) => time >= c.startTime && time < clipEnd(c));

/** Returns a snapped time when within tolerance of any edge or the playhead. */
export function snapTime(time: number, candidates: number[], tolerance: number): number {
  let best = time;
  let bestDist = tolerance;
  for (const c of candidates) {
    const d = Math.abs(c - time);
    if (d <= bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}

export function snapCandidates(tracks: Track[], excludeClipId: string | null, playhead: number): number[] {
  const out = [0, playhead];
  for (const t of tracks)
    for (const c of t.clips) {
      if (c.id === excludeClipId) continue;
      out.push(c.startTime, clipEnd(c));
    }
  return out;
}

export function nextTrackLabel(tracks: Track[], type: "video" | "audio"): { label: string; name: string } {
  if (type === "video") {
    const n = tracks.filter((t) => t.type === "video" || t.type === "overlay").length + 1;
    return { label: `V${n}`, name: `Video ${n}` };
  }
  const n = tracks.filter((t) => t.type === "audio").length + 1;
  return { label: `A${n}`, name: `Audio ${n}` };
}
