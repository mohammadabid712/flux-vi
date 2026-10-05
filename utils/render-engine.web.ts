import { Asset } from "expo-asset";
import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import { Artwork, findMedia, lutById } from "@/constants/media";
import { Fonts } from "@/constants/Typography";
import type { MediaAsset, Project } from "@/store/types";
import { computeFrame, cssFilterFor, type TextLayer, type VisualLayer } from "./composite";
import { RenderCancelled, type RenderConfig, type RenderProgress, type RenderResult, type RenderSignal, evenDim } from "./render-types";

type Ctx = OffscreenCanvasRenderingContext2D;

export const canEncodeFile =
  typeof globalThis !== "undefined" &&
  typeof (globalThis as { VideoEncoder?: unknown }).VideoEncoder === "function" &&
  typeof (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas === "function";

const AVC_CODECS = ["avc1.640033", "avc1.640028", "avc1.4d0028", "avc1.42002a", "avc1.42001f"];

async function pickVideoConfig(width: number, height: number, fps: number, bitrate: number): Promise<VideoEncoderConfig | null> {
  for (const codec of AVC_CODECS) {
    const cfg: VideoEncoderConfig = { codec, width, height, bitrate, framerate: fps, bitrateMode: "variable", avc: { format: "avc" } };
    try {
      const res = await VideoEncoder.isConfigSupported(cfg);
      if (res.supported) return cfg;
    } catch (e) {
      console.error("Encoder config check failed", codec, e);
    }
  }
  return null;
}

async function loadBitmap(uri: string): Promise<ImageBitmap> {
  const res = await fetch(uri);
  if (!res.ok) throw new Error(`Failed to load media (${res.status})`);
  return createImageBitmap(await res.blob());
}

async function loadSources(project: Project, userMedia: MediaAsset[]): Promise<Map<string, ImageBitmap>> {
  const ids = new Set<string>();
  for (const t of project.tracks) for (const c of t.clips) if (c.type === "video" || c.type === "image") ids.add(c.mediaId);
  const out = new Map<string, ImageBitmap>();
  await Promise.all(
    [...ids].map(async (id) => {
      const m = findMedia(id, userMedia);
      if (!m) return;
      try {
        const uri = m.artwork ? Asset.fromModule(Artwork[m.artwork] as number).uri : m.type === "image" ? m.url : m.thumbnailUrl;
        if (uri) out.set(id, await loadBitmap(uri));
      } catch (e) {
        console.error("Could not load media for render", id, e);
      }
    }),
  );
  return out;
}

const supportsFilter = (ctx: Ctx) => "filter" in ctx;

type Drawable = ImageBitmap | OffscreenCanvas;
const filteredCache = new Map<string, Drawable>();

/** LUT/adjustments are constant per clip, so each source is filtered once and reused. */
function filtered(bmp: ImageBitmap, key: string, filter: string): Drawable {
  if (!filter) return bmp;
  const k = `${key}|${filter}`;
  const hit = filteredCache.get(k);
  if (hit) return hit;
  const off = new OffscreenCanvas(bmp.width, bmp.height);
  const octx = off.getContext("2d");
  if (!octx || !supportsFilter(octx)) return bmp;
  octx.filter = filter;
  octx.drawImage(bmp, 0, 0);
  filteredCache.set(k, off);
  return off;
}

function drawVisual(ctx: Ctx, layer: VisualLayer, bmp: ImageBitmap | undefined, W: number, H: number, isBase: boolean) {
  const { clip } = layer;
  const t = clip.transform;
  const pip = !isBase || t.scale < 0.98;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));
  ctx.translate(W / 2 + (t.posX + layer.offsetX) * W, H / 2 + t.posY * H);
  ctx.rotate((t.rotation * Math.PI) / 180);
  ctx.scale(t.scale * layer.extraScale, t.scale * layer.extraScale);
  ctx.beginPath();
  if (pip) ctx.roundRect(-W / 2, -H / 2, W, H, Math.max(6, W * 0.012));
  else ctx.rect(-W / 2, -H / 2, W, H);
  ctx.clip();
  if (bmp) {
    const lut = lutById(clip.filter);
    const src = filtered(bmp, clip.mediaId, cssFilterFor(clip, lut.css));
    const cover = Math.max(W / bmp.width, H / bmp.height) * layer.kenScale;
    const dw = bmp.width * cover;
    const dh = bmp.height * cover;
    const glitch = layer.glitch > 0 ? Math.sin(layer.sourceTime * 90) * layer.glitch * W * 0.03 : 0;
    ctx.save();
    if (clip.reverse) ctx.scale(-1, 1);
    ctx.drawImage(src, -dw / 2 + layer.kenX * W + glitch, -dh / 2 + layer.kenY * H, dw, dh);
    ctx.restore();
    if (lut.tintOpacity > 0) {
      ctx.globalAlpha *= lut.tintOpacity;
      ctx.fillStyle = lut.tint;
      ctx.fillRect(-W / 2, -H / 2, W, H);
      ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));
    }
  } else {
    ctx.fillStyle = "#111318";
    ctx.fillRect(-W / 2, -H / 2, W, H);
  }
  if (layer.glitch > 0) {
    ctx.fillStyle = "rgba(236,72,153,0.45)";
    ctx.fillRect(-W / 2, -H / 2 + ((layer.sourceTime * 37) % 0.8) * H, W, H * 0.06);
    ctx.fillStyle = "rgba(34,211,238,0.4)";
    ctx.fillRect(-W / 2, -H / 2 + ((layer.sourceTime * 53) % 0.9) * H, W, H * 0.03);
  }
  if (layer.dip > 0) {
    ctx.globalAlpha = layer.dip;
    ctx.fillStyle = "#000";
    ctx.fillRect(-W / 2, -H / 2, W, H);
  }
  ctx.restore();
  if (pip) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));
    ctx.translate(W / 2 + (t.posX + layer.offsetX) * W, H / 2 + t.posY * H);
    ctx.rotate((t.rotation * Math.PI) / 180);
    ctx.scale(t.scale * layer.extraScale, t.scale * layer.extraScale);
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 3 / Math.max(0.1, t.scale);
    ctx.beginPath();
    ctx.roundRect(-W / 2, -H / 2, W, H, Math.max(6, W * 0.012));
    ctx.stroke();
    ctx.restore();
  }
}

const canvasFont = (family: string | undefined, size: number) => {
  const name = family === "JetBrains Mono" ? Fonts.monoBold : family === "System" ? "system-ui" : Fonts.extraBold;
  return `${Math.round(size)}px "${name}", system-ui, sans-serif`;
};

function drawText(ctx: Ctx, layer: TextLayer, W: number, H: number) {
  const p = layer.clip.textProperties;
  if (!p) return;
  const k = Math.min(W, H) / 1080;
  const size = Math.max(8, p.fontSize * k * (H > W ? 1 : 1.25));
  const text = p.content.slice(0, layer.visibleChars);
  const t = layer.clip.transform;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));
  ctx.translate(t.posX * W, t.posY * H + layer.translateY * k * 2);
  ctx.textBaseline = "middle";
  const scaleAround = (x: number, y: number) => {
    ctx.translate(x, y);
    ctx.scale(layer.scale * t.scale, layer.scale * t.scale);
    ctx.rotate((t.rotation * Math.PI) / 180);
    ctx.translate(-x, -y);
  };
  switch (p.style) {
    case "title": {
      const fs = size * 1.25;
      const x = W * 0.05;
      const y = H * 0.32 + fs * 0.6;
      scaleAround(x, y);
      ctx.font = `italic ${canvasFont(p.fontFamily, fs)}`;
      ctx.textAlign = "left";
      ctx.shadowColor = "rgba(139,92,246,0.9)";
      ctx.shadowBlur = fs * 0.2;
      ctx.fillStyle = p.fontColor;
      ctx.fillText(text, x, y);
      if (p.bgEnabled) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = p.bgColor;
        ctx.fillRect(x, y + fs * 0.6, fs * 4, fs * 0.35);
      }
      break;
    }
    case "lower": {
      const fs = size * 0.8;
      ctx.font = canvasFont(p.fontFamily, fs);
      ctx.textAlign = "left";
      const x = W * 0.05;
      const y = H * 0.9 - fs;
      scaleAround(x, y);
      const w = ctx.measureText(text).width;
      if (p.bgEnabled) {
        ctx.fillStyle = p.bgColor;
        ctx.beginPath();
        ctx.roundRect(x, y - fs * 0.75, w + fs, fs * 1.5, fs * 0.25);
        ctx.fill();
      }
      ctx.fillStyle = p.fontColor;
      ctx.fillText(text, x + fs * 0.5, y);
      break;
    }
    case "neon": {
      ctx.font = canvasFont(p.fontFamily, size);
      ctx.textAlign = "center";
      const y = H * 0.42 + size * 0.6;
      scaleAround(W / 2, y);
      ctx.shadowColor = p.fontColor;
      ctx.shadowBlur = size * 0.5;
      ctx.fillStyle = p.fontColor;
      ctx.fillText(text, W / 2, y);
      break;
    }
    default: {
      const fs = size * 0.8;
      ctx.font = canvasFont(p.fontFamily, fs);
      ctx.textAlign = "center";
      const y = H * 0.92 - fs;
      scaleAround(W / 2, y);
      const w = ctx.measureText(text).width;
      if (p.bgEnabled) {
        ctx.fillStyle = `${p.bgColor}B3`;
        ctx.beginPath();
        ctx.roundRect(W / 2 - w / 2 - fs * 0.4, y - fs * 0.7, w + fs * 0.8, fs * 1.4, fs * 0.15);
        ctx.fill();
      }
      ctx.fillStyle = p.fontColor;
      ctx.fillText(text, W / 2, y);
    }
  }
  ctx.restore();
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export async function renderProject(
  project: Project,
  userMedia: MediaAsset[],
  config: RenderConfig,
  onProgress: (p: RenderProgress) => void,
  signal: RenderSignal,
): Promise<RenderResult> {
  if (!canEncodeFile) throw new Error("This browser does not support in-browser MP4 encoding (WebCodecs). Try Chrome, Edge or Safari 17+.");
  if (project.duration <= 0) throw new Error("The timeline is empty — add clips before rendering.");
  const started = Date.now();
  let width = evenDim(config.width);
  let height = evenDim(config.height);
  let videoCfg = await pickVideoConfig(width, height, config.fps, config.bitrate);
  let note: string | undefined;
  if (!videoCfg && Math.max(width, height) > 1920) {
    const k = 1920 / Math.max(width, height);
    width = evenDim(width * k);
    height = evenDim(height * k);
    videoCfg = await pickVideoConfig(width, height, config.fps, config.bitrate);
    note = "Your browser's encoder does not support 4K; rendered at 1080p instead.";
  }
  if (!videoCfg) throw new Error("No supported H.264 encoder configuration was found in this browser.");

  const audioCfg: AudioEncoderConfig = { codec: "mp4a.40.2", sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 };
  let hasAudio = false;
  try {
    hasAudio = typeof AudioEncoder === "function" && !!(await AudioEncoder.isConfigSupported(audioCfg)).supported;
  } catch (e) {
    console.error("AAC support check failed", e);
  }

  const sources = await loadSources(project, userMedia);
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width, height, frameRate: config.fps },
    audio: hasAudio ? { codec: "aac", numberOfChannels: 2, sampleRate: 48000 } : undefined,
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });

  let encodeError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encodeError = e instanceof Error ? e : new Error(String(e));
    },
  });
  encoder.configure(videoCfg);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  const totalFrames = Math.max(1, Math.ceil(project.duration * config.fps));
  const frameUs = 1_000_000 / config.fps;

  try {
    for (let i = 0; i < totalFrames; i++) {
      if (signal.cancelled) throw new RenderCancelled();
      if (encodeError) throw encodeError;
      const time = Math.min(project.duration - 0.0001, i / config.fps);
      const frame = computeFrame(project.tracks, time);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);
      frame.visuals.forEach((v, idx) => {
        drawVisual(ctx, v, sources.get(v.clip.mediaId), width, height, idx === 0);
      });
      for (const tl of frame.texts) drawText(ctx, tl, width, height);
      const vf = new VideoFrame(canvas, { timestamp: Math.round(i * frameUs), duration: Math.round(frameUs) });
      encoder.encode(vf, { keyFrame: i % (config.fps * 2) === 0 });
      vf.close();
      while (encoder.encodeQueueSize > 4) await new Promise<void>((r) => setTimeout(r, 2));
      if (i % 6 === 0 || i === totalFrames - 1) {
        onProgress({ frame: i + 1, totalFrames, time, elapsedMs: Date.now() - started });
        await tick();
      }
    }
    await encoder.flush();
    if (encodeError) throw encodeError;

    if (hasAudio) {
      const audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error: (e) => console.error("Audio encode error", e),
      });
      audioEncoder.configure(audioCfg);
      const block = 1024;
      const totalSamples = Math.ceil(project.duration * 48000);
      const silence = new Float32Array(block * 2);
      for (let s = 0; s < totalSamples; s += block) {
        if (signal.cancelled) throw new RenderCancelled();
        const data = new AudioData({ format: "f32-planar", sampleRate: 48000, numberOfFrames: block, numberOfChannels: 2, timestamp: Math.round((s / 48000) * 1_000_000), data: silence });
        audioEncoder.encode(data);
        data.close();
        if (s % (block * 200) === 0) await tick();
      }
      await audioEncoder.flush();
      audioEncoder.close();
    }

    muxer.finalize();
  } finally {
    if (encoder.state !== "closed") encoder.close();
    for (const b of sources.values()) b.close();
    filteredCache.clear();
  }

  const blob = new Blob([target.buffer], { type: "video/mp4" });
  return {
    url: URL.createObjectURL(blob),
    blob,
    sizeBytes: blob.size,
    frames: totalFrames,
    width,
    height,
    fps: config.fps,
    hasAudio,
    fileName: config.fileName,
    elapsedMs: Date.now() - started,
    note,
  };
}

interface AnchorLike {
  href: string;
  download: string;
  rel: string;
  click: () => void;
  remove: () => void;
}

interface DocLike {
  createElement: (tag: string) => AnchorLike;
  body: { appendChild: (n: AnchorLike) => void };
}

export function downloadRender(result: RenderResult): Promise<"downloaded" | "unsupported"> {
  // Web-only module: the DOM exists here and never on Hermes.
  const doc = (globalThis as { document?: DocLike }).document;
  if (!result.url || !doc) return Promise.resolve("unsupported");
  const a = doc.createElement("a");
  a.href = result.url;
  a.download = result.fileName;
  a.rel = "noopener";
  doc.body.appendChild(a);
  a.click();
  a.remove();
  return Promise.resolve("downloaded");
}

export async function shareRender(result: RenderResult): Promise<"shared" | "downloaded" | "cancelled" | "unsupported"> {
  if (!result.blob) return "unsupported";
  const nav = globalThis.navigator as Navigator | undefined;
  const file = new File([result.blob], result.fileName, { type: "video/mp4" });
  if (nav?.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: result.fileName });
      return "shared";
    } catch (e) {
      console.error("Share sheet dismissed or failed", e);
      if ((e as { name?: string }).name === "AbortError") return "cancelled";
    }
  }
  return downloadRender(result);
}

export function releaseRender(result: RenderResult | null): void {
  if (result?.url) URL.revokeObjectURL(result.url);
}
