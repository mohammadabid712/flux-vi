const pad = (n: number, len = 2) => String(Math.max(0, Math.floor(n))).padStart(len, "0");

/** HH:MM:SS:FF timecode for a time in seconds. */
export function toTimecode(seconds: number, fps: number): string {
  const safe = Math.max(0, seconds);
  const totalFrames = Math.round(safe * fps);
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(frames)}`;
}

/** MM:SS for a duration in seconds. */
export function toClock(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  if (m >= 60) return `${pad(Math.floor(m / 60))}:${pad(m % 60)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

/** Ruler label HH:MM:SS. */
export function toRulerLabel(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  return `${pad(Math.floor(safe / 3600))}:${pad(Math.floor(safe / 60) % 60)}:${pad(safe % 60)}`;
}

export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "just now";
  const diff = Math.max(0, now - then) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export const volumeToDb = (v: number): number => {
  if (v <= 0.001) return -60;
  return Math.max(-60, Math.min(6, 20 * Math.log10(v)));
};

export const dbToVolume = (db: number): number => (db <= -60 ? 0 : 10 ** (db / 20));

export const formatDb = (v: number): string => {
  const db = volumeToDb(v);
  if (db <= -60) return "-∞dB";
  return `${db > 0 ? "+" : ""}${db.toFixed(Math.abs(db) < 10 ? 1 : 0).replace(".0", "")}dB`;
};
