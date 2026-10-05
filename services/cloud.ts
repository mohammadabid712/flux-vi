import { MEDIA_BUCKET, supabase } from "@/lib/supabase";
import type { ArtworkKey, AspectRatio, FrameRate, MediaAsset, Profile, Project, Track } from "@/store/types";
import { newId } from "@/utils/id";

interface ProjectRow {
  id: string;
  user_id: string;
  title: string;
  aspect_ratio: string;
  resolution: string;
  fps: number;
  duration: number;
  tracks_data: Track[] | null;
  cover_art: string | null;
  created_at: string;
  updated_at: string;
}

interface MediaRow {
  id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  storage_path: string;
  file_size: number;
  mime_type: string | null;
  media_type: "video" | "audio" | "image";
  duration: number;
  created_at: string;
}

interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  storage_used_bytes: number;
  created_at: string;
}

const ASPECTS: AspectRatio[] = ["16:9", "9:16", "1:1", "4:5"];
const ARTWORK: ArtworkKey[] = ["city", "lake", "cyber", "camera", "laptop", "mic", "hiker"];
const PROJECT_COLUMNS = "id,user_id,title,aspect_ratio,resolution,fps,duration,tracks_data,cover_art,created_at,updated_at";

/** Normalise any thrown value (PostgrestError, StorageError, AuthError objects) into a readable message. */
export function errorMessage(e: unknown, fallback = "Something went wrong"): string {
  if (typeof e === "object" && e !== null && "message" in e && typeof (e as { message: unknown }).message === "string") {
    const msg = (e as { message: string }).message;
    if (/failed to fetch|network request failed|load failed/i.test(msg)) return "You appear to be offline";
    return msg || fallback;
  }
  return fallback;
}

const toIso = (v: string) => new Date(v).toISOString();

function rowToProject(r: ProjectRow): Project {
  const [w, h] = r.resolution.split("x").map((n) => Number.parseInt(n, 10));
  const fps = ([24, 30, 60] as const).find((f) => f === r.fps) ?? 30;
  return {
    id: r.id,
    title: r.title,
    aspectRatio: ASPECTS.find((a) => a === r.aspect_ratio) ?? "16:9",
    resolution: { width: w || 1920, height: h || 1080 },
    frameRate: fps as FrameRate,
    duration: r.duration,
    currentTime: 0,
    tracks: Array.isArray(r.tracks_data) ? r.tracks_data : [],
    history: { past: [], future: [] },
    coverArt: ARTWORK.find((a) => a === r.cover_art) ?? "city",
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
    ownerId: r.user_id,
  };
}

function projectToRow(p: Project, userId: string): ProjectRow {
  return {
    id: p.id,
    user_id: userId,
    title: p.title,
    aspect_ratio: p.aspectRatio,
    resolution: `${p.resolution.width}x${p.resolution.height}`,
    fps: p.frameRate,
    duration: p.duration,
    tracks_data: p.tracks,
    cover_art: p.coverArt,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

function rowToMedia(r: MediaRow): MediaAsset {
  return {
    id: `cloud-${r.id}`,
    name: r.file_name.replace(/\.[^.]+$/, ""),
    type: r.media_type,
    url: r.file_url,
    thumbnailUrl: r.media_type === "image" ? r.file_url : "",
    duration: r.duration,
    resolution: r.mime_type ?? r.media_type,
    fileSize: formatBytes(r.file_size),
    category: "user_upload",
    ownerId: r.user_id,
    cloudId: r.id,
    storagePath: r.storage_path,
    sizeBytes: r.file_size,
  };
}

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from("projects").select(PROJECT_COLUMNS).order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as ProjectRow[]).map(rowToProject);
}

export type PushResult = { kind: "pushed"; updatedAt: string } | { kind: "remote-newer"; project: Project };

/**
 * Last-write-wins upsert: if the cloud copy carries a newer client timestamp
 * (edited on another device), the remote version is returned instead.
 */
export async function pushProject(p: Project, userId: string): Promise<PushResult> {
  const { data: existing, error: readErr } = await supabase.from("projects").select(PROJECT_COLUMNS).eq("id", p.id).maybeSingle();
  if (readErr) throw readErr;
  if (existing && toIso((existing as ProjectRow).updated_at) > p.updatedAt) {
    return { kind: "remote-newer", project: rowToProject(existing as ProjectRow) };
  }
  const { error } = await supabase.from("projects").upsert(projectToRow(p, userId), { onConflict: "id" });
  if (error) throw error;
  return { kind: "pushed", updatedAt: p.updatedAt };
}

export async function deleteRemoteProject(id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchMedia(): Promise<MediaAsset[]> {
  const { data, error } = await supabase
    .from("media_assets")
    .select("id,user_id,file_name,file_url,storage_path,file_size,mime_type,media_type,duration,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as MediaRow[]).map(rowToMedia);
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,display_name,avatar_url,storage_used_bytes,created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as ProfileRow;
  return {
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    storageUsedBytes: Number(r.storage_used_bytes) || 0,
    createdAt: r.created_at,
  };
}

/** Ensures a profile exists (covers accounts created before the signup trigger). */
export async function ensureProfile(userId: string, email: string | null, displayName: string | null): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, email, display_name: displayName }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error;
}

export interface UploadInput {
  name: string;
  mimeType: string;
  size: number;
  mediaType: "video" | "audio" | "image";
  duration: number;
  body: ArrayBuffer | Blob;
  projectId?: string;
}

/** Uploads a file to the user's folder in the project-media bucket and records it in media_assets. */
export async function uploadMedia(userId: string, input: UploadInput): Promise<MediaAsset> {
  const safeName = input.name.replace(/[^\w.-]+/g, "_").slice(-80) || "upload";
  const path = `${userId}/${newId()}-${safeName}`;
  const { error: upErr } = await supabase.storage.from(MEDIA_BUCKET).upload(path, input.body, {
    contentType: input.mimeType,
    upsert: false,
  });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  const { data, error } = await supabase
    .from("media_assets")
    .insert({
      user_id: userId,
      project_id: input.projectId ?? null,
      file_name: input.name,
      file_url: pub.publicUrl,
      storage_path: path,
      file_size: input.size,
      mime_type: input.mimeType,
      media_type: input.mediaType,
      duration: input.duration,
    })
    .select("id,user_id,file_name,file_url,storage_path,file_size,mime_type,media_type,duration,created_at")
    .single();
  if (error) {
    // Roll back the orphaned object so storage usage stays accurate.
    const { error: rmErr } = await supabase.storage.from(MEDIA_BUCKET).remove([path]);
    if (rmErr) console.error("Could not remove orphaned upload", rmErr);
    throw error;
  }
  return rowToMedia(data as MediaRow);
}

export interface ExportRecord {
  projectId: string;
  preset: string;
  width: number;
  height: number;
  fps: number;
  fileName: string;
  sizeBytes: number;
}

export async function recordExport(rec: ExportRecord): Promise<void> {
  const { error } = await supabase.from("exports").insert({
    project_id: rec.projectId,
    preset: rec.preset,
    width: rec.width,
    height: rec.height,
    fps: rec.fps,
    file_name: rec.fileName,
    size_bytes: Math.round(rec.sizeBytes),
  });
  if (error) throw error;
}
