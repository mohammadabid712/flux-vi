import type { MediaAsset, Project } from "@/store/types";
import { RenderCancelled, type RenderConfig, type RenderProgress, type RenderResult, type RenderSignal } from "./render-types";

/**
 * Native fallback: there is no hardware encoder bridge in this build, so the
 * render pass is simulated frame-by-frame and no file is produced.
 */
export const canEncodeFile = false;

export async function renderProject(
  project: Project,
  _userMedia: MediaAsset[],
  config: RenderConfig,
  onProgress: (p: RenderProgress) => void,
  signal: RenderSignal,
): Promise<RenderResult> {
  const totalFrames = Math.max(1, Math.ceil(project.duration * config.fps));
  const started = Date.now();
  const perTick = Math.max(1, Math.round(totalFrames / 240));
  for (let frame = 0; frame < totalFrames; frame += perTick) {
    if (signal.cancelled) throw new RenderCancelled();
    await new Promise((r) => setTimeout(r, 16));
    onProgress({ frame, totalFrames, time: frame / config.fps, elapsedMs: Date.now() - started });
  }
  onProgress({ frame: totalFrames, totalFrames, time: project.duration, elapsedMs: Date.now() - started });
  return {
    url: null,
    blob: null,
    sizeBytes: Math.round((config.bitrate * project.duration) / 8),
    frames: totalFrames,
    width: config.width,
    height: config.height,
    fps: config.fps,
    hasAudio: false,
    fileName: config.fileName,
    elapsedMs: Date.now() - started,
    note: "Preview render only — MP4 file encoding runs in the web studio.",
  };
}

export function downloadRender(_result: RenderResult): Promise<"downloaded" | "unsupported"> {
  return Promise.resolve("unsupported");
}

export function shareRender(_result: RenderResult): Promise<"shared" | "downloaded" | "cancelled" | "unsupported"> {
  return Promise.resolve("unsupported");
}

export function releaseRender(_result: RenderResult | null): void {
  // Nothing to release on native.
}
