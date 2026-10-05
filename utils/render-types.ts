export interface RenderConfig {
  width: number;
  height: number;
  fps: number;
  bitrate: number; // bits per second
  fileName: string;
}

export interface RenderProgress {
  frame: number;
  totalFrames: number;
  time: number;
  elapsedMs: number;
}

export interface RenderResult {
  url: string | null;
  blob: Blob | null;
  sizeBytes: number;
  frames: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  fileName: string;
  elapsedMs: number;
  note?: string;
}

export interface RenderSignal {
  cancelled: boolean;
}

export class RenderCancelled extends Error {
  constructor() {
    super("Render cancelled");
    this.name = "RenderCancelled";
  }
}

export const evenDim = (n: number) => Math.max(2, Math.round(n / 2) * 2);
