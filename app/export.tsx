import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { CompositeFrame } from "@/components/editor/composite-frame";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { Segmented } from "@/components/ui/segmented";
import { LoadingState, MessageState } from "@/components/ui/state-views";
import { useToast } from "@/components/ui/toast";
import { aspectValue, resolutionLabel } from "@/constants/presets";
import { Fonts } from "@/constants/Typography";
import { makeStyles } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { AspectRatio } from "@/store/types";
import { useAppStore } from "@/store/useAppStore";
import { canEncodeFile, downloadRender, releaseRender, renderProject, shareRender } from "@/utils/render-engine";
import { RenderCancelled, type RenderProgress, type RenderResult, evenDim } from "@/utils/render-types";
import { toClock } from "@/utils/timecode";

type Preset = "youtube" | "tiktok" | "instagram" | "custom";
type Quality = "high" | "standard" | "draft";
type Phase = "idle" | "rendering" | "done" | "error";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "custom", label: "Custom" },
];
const RESOLUTIONS = [
  { value: 2160, label: "4K" },
  { value: 1080, label: "1080p" },
  { value: 720, label: "720p" },
];
const FPS = [
  { value: 24, label: "24fps" },
  { value: 30, label: "30fps" },
  { value: 60, label: "60fps" },
];
const QUALITY: { value: Quality; label: string }[] = [
  { value: "high", label: "High Bitrate" },
  { value: "standard", label: "Standard" },
  { value: "draft", label: "Draft" },
];
const CUSTOM_BITRATES = [
  { value: 4, label: "4 Mbps" },
  { value: 8, label: "8 Mbps" },
  { value: 16, label: "16 Mbps" },
  { value: 32, label: "32 Mbps" },
];

const BASE_MBPS: Record<number, Record<Quality, number>> = {
  2160: { high: 24, standard: 14, draft: 6 },
  1080: { high: 10, standard: 6, draft: 3 },
  720: { high: 5, standard: 3, draft: 1.5 },
};

const presetAspect = (p: Preset, projectAr: AspectRatio): AspectRatio =>
  p === "youtube" ? "16:9" : p === "tiktok" ? "9:16" : p === "instagram" ? "1:1" : projectAr;

const dims = (ar: AspectRatio, short: number) => {
  const r = aspectValue(ar);
  return r >= 1 ? { width: evenDim(short * r), height: short } : { width: short, height: evenDim(short / r) };
};

const formatBytes = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : `${(b / 1024 ** 2).toFixed(1)} MB`);

function ProgressRing({ pct, size = 96 }: { pct: number; size?: number }) {
  const { colors } = useTheme();
  const r = size / 2 - 7;
  const circ = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.cyan} />
            <Stop offset="1" stopColor={colors.primary} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={7} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring)"
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${(circ * Math.max(0.5, pct)) / 100} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={{ position: "absolute", fontFamily: Fonts.bold, fontSize: size * 0.22, color: colors.text }}>{Math.floor(pct)}%</Text>
    </View>
  );
}

export default function ExportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { theme, colors } = useTheme();
  const s = useStyles(theme);
  const hydrated = useAppStore((st) => st.hasHydrated);
  const project = useAppStore((st) => st.projects.find((p) => p.id === params.id));
  const userMedia = useAppStore((st) => st.userMedia);
  const { toastNode, showToast } = useToast();

  const initialPreset: Preset = project?.aspectRatio === "9:16" ? "tiktok" : project?.aspectRatio === "1:1" ? "instagram" : "youtube";
  const [preset, setPreset] = useState<Preset>(initialPreset);
  const [short, setShort] = useState(initialPreset === "youtube" ? 2160 : 1080);
  const [fps, setFps] = useState(initialPreset === "tiktok" ? 60 : 30);
  const [quality, setQuality] = useState<Quality>("high");
  const [customMbps, setCustomMbps] = useState(16);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const signal = useRef({ cancelled: false });

  useEffect(() => () => {
    signal.current.cancelled = true;
  }, []);
  useEffect(() => () => releaseRender(result), [result]);

  const choosePreset = useCallback((p: Preset) => {
    setPreset(p);
    if (p === "youtube") {
      setShort(2160);
      setFps(30);
    } else if (p === "tiktok") {
      setShort(1080);
      setFps(60);
    } else if (p === "instagram") {
      setShort(1080);
      setFps(30);
    }
  }, []);

  const ar = presetAspect(preset, project?.aspectRatio ?? "16:9");
  const out = dims(ar, short);
  const mbps = preset === "custom" ? customMbps : BASE_MBPS[short][quality] * (fps === 60 ? 1.4 : fps === 24 ? 0.85 : 1);
  const duration = project?.duration ?? 0;
  const estBytes = ((mbps * 1_000_000 + 128_000) * duration) / 8;
  const slug = (project?.title ?? "veloce-export").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  const fileName = `${slug || "veloce-export"}-${resolutionLabel(out.width, out.height).toLowerCase()}-${fps}fps.mp4`;

  const startRender = async () => {
    if (!project) return;
    if (project.duration <= 0) {
      showToast("Timeline is empty — add clips first", "error");
      return;
    }
    releaseRender(result);
    setResult(null);
    setError(null);
    setProgress({ frame: 0, totalFrames: Math.ceil(project.duration * fps), time: 0, elapsedMs: 0 });
    setPhase("rendering");
    signal.current = { cancelled: false };
    try {
      const res = await renderProject(project, userMedia, { width: out.width, height: out.height, fps, bitrate: Math.round(mbps * 1_000_000), fileName }, setProgress, signal.current);
      setResult(res);
      setPhase("done");
    } catch (e) {
      console.error("Render failed", e);
      if (e instanceof RenderCancelled) {
        setPhase("idle");
        setProgress(null);
        showToast("Render cancelled");
        return;
      }
      setError(e instanceof Error ? e.message : "Unknown render error");
      setPhase("error");
    }
  };

  const cancelRender = () => {
    signal.current.cancelled = true;
  };

  const onDownload = async () => {
    if (!result) return;
    setBusy("download");
    try {
      const r = await downloadRender(result);
      showToast(r === "downloaded" ? `Downloading ${result.fileName}` : "MP4 download is available in the web studio", r === "downloaded" ? "success" : "error");
    } catch (e) {
      console.error("Download failed", e);
      showToast("Download failed", "error");
    } finally {
      setBusy(null);
    }
  };

  const onCopyLink = async () => {
    if (!result?.url) {
      showToast("No video file to link — render in the web studio", "error");
      return;
    }
    try {
      await Clipboard.setStringAsync(result.url);
      showToast("Local video link copied (valid in this browser session)", "success");
    } catch (e) {
      console.error("Clipboard failed", e);
      showToast("Could not copy link", "error");
    }
  };

  const onSave = async () => {
    if (!result) return;
    setBusy("share");
    try {
      const r = await shareRender(result);
      const msg = { shared: "Sent to share sheet", downloaded: "Saved to your downloads", cancelled: "Save cancelled", unsupported: "Saving needs a rendered MP4 file (web studio)" }[r];
      showToast(msg, r === "unsupported" ? "error" : r === "cancelled" ? "info" : "success");
    } catch (e) {
      console.error("Save failed", e);
      showToast("Could not save video", "error");
    } finally {
      setBusy(null);
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: "/editor", params: { id: params.id ?? "" } }));

  if (!hydrated) return <LoadingState label="Preparing export…" />;
  if (!project) {
    return <MessageState title="Project not found" message="Open a project in the editor before exporting." actionLabel="Back to Projects" onAction={() => router.replace("/")} />;
  }

  const wide = width >= 720;
  const pct = progress ? (progress.frame / Math.max(1, progress.totalFrames)) * 100 : 0;
  const etaMs = progress && progress.frame > 0 ? (progress.elapsedMs / progress.frame) * (progress.totalFrames - progress.frame) : 0;
  const previewTime = phase === "rendering" && progress ? progress.time : Math.min(project.currentTime || duration * 0.3, duration);
  const status =
    phase === "rendering"
      ? { label: "Rendering", color: colors.cyan }
      : phase === "done"
        ? { label: "Render Complete", color: colors.green }
        : phase === "error"
          ? { label: "Render Failed", color: colors.red }
          : { label: "Ready to Render", color: colors.green };
  const settingsLocked = phase === "rendering";

  const previewW = wide ? Math.min(460, (Math.min(width, 1080) - 60) / 2) - 26 : Math.min(width, 640) - 60;
  const pr = aspectValue(ar);
  const pvH = Math.min(previewW / pr, 300);
  const pvW = pvH * pr;

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]}>
        <View style={s.inner}>
          <View style={s.header}>
            <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back to editor" hitSlop={8}>
              <View style={s.back}>
                <Ionicons name="chevron-back" size={20} color={colors.muted} />
                <Logo size={38} />
              </View>
            </Pressable>
            <View style={s.flexShrink}>
              <Text numberOfLines={1} style={s.h1}>Export & Render Studio</Text>
              <Text numberOfLines={1} style={s.h1Sub}>{project.title}</Text>
            </View>
            <View style={[s.status, { borderColor: `${status.color}66`, backgroundColor: `${status.color}1A` }]}>
              <View style={[s.statusDot, { backgroundColor: status.color }]} />
              <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>

          <View style={[s.cols, !wide && s.colsStack]}>
            <View style={[s.card, s.col]} pointerEvents={settingsLocked ? "none" : "auto"}>
              <Text style={s.cardTitle}>Export Settings</Text>
              <Text style={s.label}>Preset</Text>
              <Segmented options={PRESETS} value={preset} onChange={choosePreset} accessibilityLabel="Export preset" wrap />
              <Text style={s.label}>Resolution</Text>
              <Segmented options={RESOLUTIONS} value={short} onChange={setShort} accessibilityLabel="Resolution" />
              <Text style={s.label}>Frame Rate</Text>
              <Segmented options={FPS} value={fps} onChange={setFps} accessibilityLabel="Frame rate" />
              {preset === "custom" ? (
                <>
                  <Text style={s.label}>Bitrate</Text>
                  <Segmented options={CUSTOM_BITRATES} value={customMbps} onChange={setCustomMbps} accessibilityLabel="Custom bitrate" wrap />
                </>
              ) : (
                <>
                  <Text style={s.label}>Quality</Text>
                  <Segmented options={QUALITY} value={quality} onChange={setQuality} accessibilityLabel="Quality" />
                </>
              )}
            </View>

            <View style={[s.card, s.col]}>
              <View style={s.previewHead}>
                <Text style={s.cardTitle}>Preview ({ar})</Text>
                <View style={s.resBadge}>
                  <Text style={s.resBadgeText}>{resolutionLabel(out.width, out.height)}</Text>
                </View>
              </View>
              <View style={s.previewStage}>
                <View style={s.previewFrame}>
                  <CompositeFrame tracks={project.tracks} time={previewTime} width={Math.floor(pvW)} height={Math.floor(pvH)} userMedia={userMedia} />
                </View>
              </View>
              <View style={s.specs}>
                {[
                  { icon: "document-text-outline", label: "Estimated file size", value: `~${formatBytes(estBytes)}` },
                  { icon: "time-outline", label: "Duration", value: toClock(duration) },
                  { icon: "code-slash-outline", label: "Encoding", value: `H.264 MP4 · ${mbps.toFixed(mbps < 10 ? 1 : 0)} Mbps` },
                  { icon: "pulse-outline", label: "Audio", value: "48kHz Stereo AAC" },
                  { icon: "resize-outline", label: "Output", value: `${out.width}×${out.height} @ ${fps}fps` },
                ].map((row) => (
                  <View key={row.label} style={s.specRow}>
                    <Ionicons name={row.icon as never} size={18} color={colors.muted} />
                    <Text style={s.specLabel}>{row.label}</Text>
                    <Text selectable style={s.specValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {phase === "rendering" ? (
            <Button label="Cancel Render" icon="stop" variant="outline" size="lg" onPress={cancelRender} />
          ) : (
            <Button label={phase === "done" ? "Render Again" : "Start Render"} icon="play" size="lg" onPress={startRender} accessibilityLabel="Start Render" />
          )}
          {!canEncodeFile ? (
            <Text style={s.notice}>This device runs a preview render pass. MP4 file encoding uses WebCodecs in the web studio.</Text>
          ) : null}

          {phase === "rendering" && progress ? (
            <Animated.View entering={FadeInDown.duration(220)} style={s.card}>
              <Text style={s.cardTitle}>Rendering…</Text>
              <View style={[s.renderRow, !wide && s.colsStack]}>
                <View style={s.renderStats}>
                  <View style={s.statRow}>
                    <ProgressRing pct={pct} />
                    <View style={s.stat}>
                      <Text style={s.statLabel}>Elapsed</Text>
                      <Text style={s.statValue}>{toClock(progress.elapsedMs / 1000)}</Text>
                    </View>
                    <View style={s.statDivider} />
                    <View style={s.stat}>
                      <Text style={s.statLabel}>ETA</Text>
                      <Text style={s.statValue}>{progress.frame > 0 ? toClock(etaMs / 1000) : "--:--"}</Text>
                    </View>
                  </View>
                  <Text style={s.frameText}>
                    Encoding frame {progress.frame.toLocaleString()} / {progress.totalFrames.toLocaleString()}
                  </Text>
                  <View style={s.bar}>
                    <View style={[s.barFill, { width: `${pct}%` }]} />
                  </View>
                </View>
                <View style={s.renderThumb}>
                  <CompositeFrame tracks={project.tracks} time={progress.time} width={176} height={Math.round(176 / pr > 200 ? 200 : 176 / pr)} userMedia={userMedia} />
                </View>
              </View>
            </Animated.View>
          ) : null}

          {phase === "error" ? (
            <Animated.View entering={FadeIn} style={[s.card, s.errorCard]}>
              <MessageState fill={false} title="Render failed" message={error ?? "Something went wrong while encoding."} actionLabel="Retry Render" onAction={startRender} secondaryLabel="Back to Editor" onSecondary={back} />
            </Animated.View>
          ) : null}

          {phase === "done" && result ? (
            <Animated.View entering={FadeInDown.duration(260)} style={[s.card, s.doneCard]}>
              <View style={s.doneHead}>
                <View style={s.check}>
                  <Ionicons name="checkmark" size={30} color="#fff" />
                </View>
                <View style={s.flexShrink}>
                  <Text style={s.doneTitle}>Render Complete!</Text>
                  <Text style={s.doneSub}>{result.url ? "Your video is ready to download." : result.note}</Text>
                </View>
              </View>
              <View style={s.summary}>
                <Text selectable style={s.summaryText}>
                  {result.fileName} · {formatBytes(result.sizeBytes)} · {result.width}×{result.height} · {result.fps}fps · {result.frames.toLocaleString()} frames · {result.hasAudio ? "AAC stereo (silent bed)" : "no audio track"} · rendered in {toClock(result.elapsedMs / 1000)}
                </Text>
                {result.url && result.note ? <Text style={s.notice}>{result.note}</Text> : null}
              </View>
              <View style={[s.doneActions, !wide && s.colsStack]}>
                <Button label="Download Video (.MP4)" icon="download-outline" size="lg" onPress={onDownload} loading={busy === "download"} flex />
                <Button label="Copy Video Link" icon="link-outline" variant="outline" size="lg" onPress={onCopyLink} flex />
                <Button label="Save to Gallery" icon="image-outline" variant="outline" size="lg" onPress={onSave} loading={busy === "share"} flex />
              </View>
              <Button label="Back to Editor" icon="arrow-back" variant="outline" size="lg" onPress={back} />
            </Animated.View>
          ) : null}
        </View>
      </ScrollView>
      {toastNode}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.bg },
  content: { paddingHorizontal: 14, alignItems: "center" },
  inner: { width: "100%", maxWidth: 1000, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  back: { flexDirection: "row", alignItems: "center" },
  flexShrink: { flexShrink: 1 },
  h1: { fontFamily: Fonts.bold, fontSize: 21, color: c.text, letterSpacing: -0.3 },
  h1Sub: { fontFamily: Fonts.regular, fontSize: 14, color: "#8B9CD8" },
  status: { flexDirection: "row", alignItems: "center", gap: 8, height: 32, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: Fonts.medium, fontSize: 13 },
  cols: { flexDirection: "row", gap: 14, alignItems: "stretch" },
  colsStack: { flexDirection: "column" },
  col: { flex: 1 },
  card: { backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 16, gap: 10 },
  cardTitle: { fontFamily: Fonts.semiBold, fontSize: 17, color: c.text },
  label: { fontFamily: Fonts.medium, fontSize: 13.5, color: c.text, marginTop: 6 },
  previewHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resBadge: { borderRadius: 8, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10, height: 28, justifyContent: "center", backgroundColor: c.panel },
  resBadgeText: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: c.text },
  previewStage: { alignItems: "center", justifyContent: "center", backgroundColor: c.canvas, borderRadius: 10, padding: 8 },
  previewFrame: { borderRadius: 6, overflow: "hidden" },
  specs: { backgroundColor: c.panel, borderRadius: 10, paddingVertical: 4 },
  specRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, height: 38 },
  specLabel: { flex: 1, fontFamily: Fonts.regular, fontSize: 13.5, color: c.text },
  specValue: { fontFamily: Fonts.medium, fontSize: 13, color: c.text, flexShrink: 1, textAlign: "right" },
  notice: { fontFamily: Fonts.regular, fontSize: 12, color: c.muted, textAlign: "center" },
  renderRow: { flexDirection: "row", gap: 16, alignItems: "center" },
  renderStats: { flex: 1, gap: 12, alignSelf: "stretch" },
  statRow: { flexDirection: "row", alignItems: "center", gap: 18 },
  stat: { gap: 4 },
  statLabel: { fontFamily: Fonts.regular, fontSize: 12.5, color: c.muted },
  statValue: { fontFamily: Fonts.semiBold, fontSize: 20, color: c.text, fontVariant: ["tabular-nums"] },
  statDivider: { width: 1, height: 44, backgroundColor: c.border },
  frameText: { fontFamily: Fonts.regular, fontSize: 13, color: c.muted, fontVariant: ["tabular-nums"] },
  bar: { height: 8, borderRadius: 4, backgroundColor: c.border, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4, backgroundColor: c.cyan, boxShadow: "0 0 10px rgba(6,182,212,0.6)" },
  renderThumb: { borderRadius: 8, borderWidth: 2, borderColor: c.cyan, overflow: "hidden", boxShadow: "0 0 18px rgba(6,182,212,0.35)" },
  errorCard: { borderColor: "rgba(239,68,68,0.4)" },
  doneCard: { backgroundColor: doneBg(c) },
  doneHead: { flexDirection: "row", alignItems: "center", gap: 14 },
  check: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#059669", alignItems: "center", justifyContent: "center", borderWidth: 6, borderColor: "rgba(16,185,129,0.25)", boxShadow: "0 0 24px rgba(16,185,129,0.45)" },
  doneTitle: { fontFamily: Fonts.bold, fontSize: 19, color: c.text },
  doneSub: { fontFamily: Fonts.regular, fontSize: 14, color: c.muted, marginTop: 2 },
  summary: { gap: 4 },
  summaryText: { fontFamily: Fonts.mono, fontSize: 11.5, color: c.muted, lineHeight: 17 },
  doneActions: { flexDirection: "row", gap: 10 },
}));

function doneBg(c: { bg: string; surface: string }) {
  return c.bg === "#0D0F12" ? "#0F1C1F" : c.surface;
}

