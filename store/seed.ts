import { SampleAudio, SampleMedia, TextPresets } from "@/constants/media";
import type { ArtworkKey, AspectRatio, Clip, FrameRate, Project, Track } from "@/store/types";
import { newId } from "@/utils/id";
import { buildClip, buildTextClip, createDefaultTracks, projectDuration, TrackColors } from "@/utils/timeline";

const media = (id: string) => {
  const m = [...SampleMedia, ...SampleAudio].find((x) => x.id === id);
  if (!m) throw new Error(`Unknown sample media ${id}`);
  return m;
};

interface Placement {
  mediaId: string;
  start: number;
  length?: number;
  inPoint?: number;
  patch?: Partial<Clip>;
}

function place(track: Track, items: Placement[]): Track {
  const clips = items.map((p) => {
    const base = buildClip(media(p.mediaId), track, p.start);
    const inPoint = p.inPoint ?? 0;
    const length = p.length ?? base.duration - inPoint;
    return { ...base, inPoint, outPoint: inPoint + length, duration: length, ...p.patch };
  });
  return { ...track, clips };
}

function titles(track: Track, items: { text: string; start: number; length: number; preset: number }[]): Track {
  return {
    ...track,
    clips: items.map((i) =>
      buildTextClip({ ...TextPresets[i.preset].props, content: i.text }, track, i.start, i.length),
    ),
  };
}

const resolutionFor = (ar: AspectRatio, height = 1080) => {
  switch (ar) {
    case "9:16":
      return { width: height, height: Math.round((height * 16) / 9) };
    case "1:1":
      return { width: height, height };
    case "4:5":
      return { width: height, height: Math.round((height * 5) / 4) };
    default:
      return { width: Math.round((height * 16) / 9), height };
  }
};

export { resolutionFor };

function project(
  title: string,
  aspectRatio: AspectRatio,
  frameRate: FrameRate,
  tracks: Track[],
  cover: ArtworkKey,
  hoursAgo: number,
): Project {
  const updated = new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();
  return {
    id: newId(),
    title,
    aspectRatio,
    resolution: resolutionFor(aspectRatio),
    frameRate,
    duration: projectDuration(tracks),
    currentTime: 0,
    tracks: tracks.map((t, i) => ({ ...t, order: i })),
    history: { past: [], future: [] },
    coverArt: cover,
    createdAt: new Date(Date.now() - (hoursAgo + 48) * 3600 * 1000).toISOString(),
    updatedAt: updated,
  };
}

export function createSeedProjects(): Project[] {
  // Cyberpunk Tokyo Vlog — 03:42, 5 tracks
  const [v2, v1, t1, a1, a2] = createDefaultTracks();
  const tokyo = project(
    "Cyberpunk Tokyo Vlog",
    "16:9",
    60,
    [
      place(v2, [
        { mediaId: "m-camera", start: 8, length: 12, patch: { transform: { scale: 0.38, posX: 0.28, posY: -0.26, opacity: 1, rotation: 0 } } },
        { mediaId: "m-hiker", start: 120, length: 15, patch: { transform: { scale: 0.36, posX: -0.28, posY: 0.24, opacity: 0.95, rotation: 0 } } },
      ]),
      place(v1, [
        { mediaId: "m-cyber", start: 0, length: 40, patch: { filter: "cyberpunk" } },
        { mediaId: "m-city", start: 40, length: 30 },
        { mediaId: "m-cyber", start: 70, length: 40 },
        { mediaId: "m-laptop", start: 110, length: 25 },
        { mediaId: "m-camera", start: 135, length: 20, patch: { transition: "dissolve" } },
        { mediaId: "m-city", start: 155, length: 30, patch: { transition: "dip" } },
        { mediaId: "m-cyber", start: 185, length: 37 },
      ]),
      titles(t1, [
        { text: "TOKYO VLOG", start: 2, length: 6, preset: 2 },
        { text: "Exploring the City", start: 40, length: 8, preset: 1 },
        { text: "Good Vibes", start: 150, length: 6, preset: 3 },
      ]),
      place(a1, [
        { mediaId: "a-voice", start: 10, length: 60, patch: { volume: 0.25 } },
        { mediaId: "a-voice", start: 80, length: 60, patch: { volume: 0.5 } },
      ]),
      place(a2, [
        { mediaId: "a-synth", start: 0, length: 120, patch: { fadeIn: 2 } },
        { mediaId: "a-electro", start: 120, length: 75 },
        { mediaId: "a-lofi", start: 195, length: 27, patch: { fadeOut: 3 } },
      ]),
    ],
    "cyber",
    2,
  );

  // Morning Routine Short — 00:58, 4 tracks
  const m = createDefaultTracks();
  const morning = project(
    "Morning Routine Short",
    "9:16",
    60,
    [
      place(m[1], [
        { mediaId: "m-hiker", start: 0, length: 30, patch: { filter: "warm" } },
        { mediaId: "m-lake", start: 30, length: 28, patch: { transition: "dissolve" } },
      ]),
      titles(m[2], [{ text: "5AM Club", start: 1, length: 4, preset: 2 }]),
      place(m[3], [{ mediaId: "a-voice", start: 2, length: 50 }]),
      place(m[4], [{ mediaId: "a-lofi", start: 0, length: 58 }]),
    ],
    "hiker",
    5,
  );

  // Tech Review Intro — 01:15, 6 tracks
  const t = createDefaultTracks();
  const extra: Track = { ...t[0], id: newId(), label: "V3", name: "Video 3", color: TrackColors.overlay, clips: [] };
  const tech = project(
    "Tech Review Intro",
    "16:9",
    60,
    [
      { ...place(extra, [{ mediaId: "m-camera", start: 30, length: 6, patch: { transform: { scale: 0.32, posX: 0.3, posY: 0.26, opacity: 1, rotation: 0 } } }]) },
      place(t[0], [{ mediaId: "m-mic", start: 50, length: 8, patch: { transform: { scale: 0.34, posX: -0.3, posY: -0.24, opacity: 1, rotation: 0 } } }]),
      place(t[1], [
        { mediaId: "m-laptop", start: 0, length: 25, patch: { filter: "cinematic" } },
        { mediaId: "m-camera", start: 25, length: 20 },
        { mediaId: "m-laptop", start: 45, length: 25 },
        { mediaId: "m-mic", start: 70, length: 5 },
      ]),
      titles(t[2], [{ text: "Unboxing the Future", start: 1, length: 5, preset: 0 }]),
      place(t[3], [{ mediaId: "a-voice", start: 5, length: 60 }]),
      place(t[4], [{ mediaId: "a-electro", start: 0, length: 75 }]),
    ],
    "laptop",
    24,
  );

  // Podcast Ep 12 Highlight — 02:30, 3 tracks
  const p = createDefaultTracks();
  const podcast = project(
    "Podcast Ep 12 Highlight",
    "16:9",
    30,
    [
      place(p[1], [0, 30, 60, 90, 120].map((s) => ({ mediaId: "m-mic", start: s, length: 30, patch: { filter: "cyberpunk" as const } }))),
      titles(p[2], [{ text: "Ep 12 — Creative Burnout", start: 0, length: 6, preset: 0 }]),
      place(p[3], [
        { mediaId: "a-voice", start: 0, length: 60 },
        { mediaId: "a-voice", start: 60, length: 60 },
        { mediaId: "a-voice", start: 120, length: 30 },
      ]),
    ],
    "mic",
    48,
  );

  return [tokyo, morning, tech, podcast];
}
