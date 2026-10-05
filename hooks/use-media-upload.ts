import * as DocumentPicker from "expo-document-picker";
import { useCallback, useState } from "react";
import type { Notify } from "@/hooks/use-editor-actions";
import { errorMessage, formatBytes, uploadMedia } from "@/services/cloud";
import { currentUserId, refreshProfile } from "@/services/sync-engine";
import type { MediaAsset } from "@/store/types";
import { useAppStore } from "@/store/useAppStore";
import { newId } from "@/utils/id";
import { probeDuration } from "@/utils/media-probe";

const MAX_BYTES = 50 * 1024 * 1024;
const DEFAULT_DURATION = { video: 10, audio: 30, image: 5 } as const;

type MediaKind = "video" | "audio" | "image";

const kindFor = (mime: string, name: string): MediaKind | null => {
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "image";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["mp4", "mov", "webm", "m4v", "mkv"].includes(ext)) return "video";
  if (["mp3", "wav", "m4a", "aac", "ogg", "flac"].includes(ext)) return "audio";
  if (["jpg", "jpeg", "png", "webp", "gif", "heic"].includes(ext)) return "image";
  return null;
};

const mimeFallback = (kind: MediaKind) => (kind === "video" ? "video/mp4" : kind === "audio" ? "audio/mpeg" : "image/jpeg");

export type UploadPhase = "idle" | "picking" | "uploading";

/**
 * Picks a video/audio/image file. Signed-in creators upload it to the
 * `project-media` bucket; guests keep a device-only reference.
 */
export function useMediaUpload(projectId: string, notify: Notify) {
  const addUserMedia = useAppStore((s) => s.addUserMedia);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progressLabel, setProgressLabel] = useState<string | null>(null);

  const pickAndUpload = useCallback(async () => {
    setPhase("picking");
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["video/*", "audio/*", "image/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets[0]) return;
      const file = res.assets[0];
      const kind = kindFor(file.mimeType ?? "", file.name);
      if (!kind) {
        notify("Unsupported file type. Choose a video, audio or image file.", "error");
        return;
      }
      const size = file.size ?? 0;
      if (size > MAX_BYTES) {
        notify(`File is ${formatBytes(size)} — the upload limit is 50 MB`, "error");
        return;
      }
      const mimeType = file.mimeType || mimeFallback(kind);
      const duration = kind === "image" ? DEFAULT_DURATION.image : await probeDuration(file.uri, DEFAULT_DURATION[kind]);
      const uid = currentUserId();

      if (!uid) {
        const local: MediaAsset = {
          id: `u-${newId()}`,
          name: file.name.replace(/\.[^.]+$/, "") || "Imported media",
          type: kind,
          url: file.uri,
          thumbnailUrl: kind === "image" ? file.uri : "",
          duration,
          resolution: mimeType,
          fileSize: formatBytes(size),
          category: "user_upload",
          sizeBytes: size,
        };
        addUserMedia(local);
        notify(`Imported "${local.name}" (local only — sign in to upload to cloud)`, "info");
        return;
      }

      setPhase("uploading");
      setProgressLabel(`Uploading ${file.name}…`);
      const body: ArrayBuffer | Blob = file.file ?? (await (await fetch(file.uri)).arrayBuffer());
      const linkedProject = useAppStore.getState().cloudVersions[projectId] ? projectId : undefined;
      const asset = await uploadMedia(uid, { name: file.name, mimeType, size, mediaType: kind, duration, body, projectId: linkedProject });
      // The account may have changed while the upload was running.
      if (currentUserId() !== uid) return;
      addUserMedia(asset);
      notify(`Uploaded "${asset.name}" to cloud storage`, "success");
      await refreshProfile();
    } catch (e) {
      console.error("Media upload failed", e);
      notify(errorMessage(e, "Upload failed. Please try again."), "error");
    } finally {
      setPhase("idle");
      setProgressLabel(null);
    }
  }, [addUserMedia, notify, projectId]);

  return { phase, progressLabel, pickAndUpload };
}
