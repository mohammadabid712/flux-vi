const PROBE_TIMEOUT_MS = 5000;

interface MediaElementLike {
  duration: number;
  preload: string;
  src: string;
  onloadedmetadata: (() => void) | null;
  onerror: (() => void) | null;
}

/** Reads a media file's duration in the browser via a detached media element. */
export function probeDuration(uri: string, fallback: number): Promise<number> {
  const AudioCtor = (globalThis as { Audio?: new () => MediaElementLike }).Audio;
  if (!AudioCtor) return Promise.resolve(fallback);
  return new Promise((resolve) => {
    let done = false;
    const el = new AudioCtor();
    const finish = (v: number) => {
      if (done) return;
      done = true;
      el.onloadedmetadata = null;
      el.onerror = null;
      el.src = "";
      resolve(v);
    };
    const timer = setTimeout(() => finish(fallback), PROBE_TIMEOUT_MS);
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      clearTimeout(timer);
      finish(Number.isFinite(el.duration) && el.duration > 0 ? Math.round(el.duration * 100) / 100 : fallback);
    };
    el.onerror = () => {
      clearTimeout(timer);
      finish(fallback);
    };
    el.src = uri;
  });
}
