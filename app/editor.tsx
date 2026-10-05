import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CanvasPreview } from "@/components/editor/canvas-preview";
import { EditorTopBar } from "@/components/editor/editor-top-bar";
import { Inspector } from "@/components/editor/inspector";
import { MediaBin } from "@/components/editor/media-bin";
import { BASE_PPS, Timeline } from "@/components/editor/timeline";
import { Segmented } from "@/components/ui/segmented";
import { LoadingState, MessageState } from "@/components/ui/state-views";
import { useToast } from "@/components/ui/toast";
import { makeStyles } from "@/constants/theme";
import { useEditorActions } from "@/hooks/use-editor-actions";
import { type HotkeyEvent, useHotkeys } from "@/hooks/use-hotkeys";
import { usePlayback } from "@/hooks/use-playback";
import { useTheme } from "@/hooks/use-theme";
import { useEditorStore } from "@/store/editor-store";
import type { AspectRatio } from "@/store/types";
import { useAppStore } from "@/store/useAppStore";

const WIDE = 1000;

export default function EditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { theme } = useTheme();
  const s = useStyles(theme);
  const hydrated = useAppStore((st) => st.hasHydrated);
  const projects = useAppStore((st) => st.projects);
  const userMedia = useAppStore((st) => st.userMedia);
  const rippleDefault = useAppStore((st) => st.settings.rippleDefault);
  const renameProject = useAppStore((st) => st.renameProject);
  const setProjectFormat = useAppStore((st) => st.setProjectFormat);
  const setCurrentTime = useAppStore((st) => st.setCurrentTime);
  const { toastNode, showToast } = useToast();
  const [panel, setPanel] = useState<"media" | "inspector">("media");

  const project = useMemo(() => {
    if (params.id) return projects.find((p) => p.id === params.id);
    return [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  }, [projects, params.id]);

  const projectId = project?.id ?? "";
  const actions = useEditorActions(projectId, showToast);
  const wide = width >= WIDE;
  const compact = width < 640;
  const initializedFor = useRef<string | null>(null);

  // Initialise the editing session when a project opens.
  useEffect(() => {
    if (!projectId || initializedFor.current === projectId) return;
    const p = useAppStore.getState().projects.find((x) => x.id === projectId);
    if (!p) return;
    initializedFor.current = projectId;
    const visible = Math.max(200, width - (width < 640 ? 128 : 176) - 40);
    const fit = p.duration > 0 ? visible / (p.duration * BASE_PPS) : 1;
    useEditorStore.getState().reset({
      currentTime: Math.min(p.currentTime, p.duration),
      zoom: Math.max(0.25, Math.min(12, fit)),
      ripple: useAppStore.getState().settings.rippleDefault,
    });
  }, [projectId, width]);

  useEffect(() => {
    useEditorStore.getState().set({ ripple: rippleDefault });
  }, [rippleDefault]);

  // Persist the playhead whenever playback stops and when leaving the editor.
  useEffect(() => {
    if (!projectId) return;
    const unsub = useEditorStore.subscribe((st, prev) => {
      if (prev.isPlaying && !st.isPlaying) setCurrentTime(projectId, st.currentTime);
    });
    return () => {
      unsub();
      const st = useEditorStore.getState();
      setCurrentTime(projectId, st.currentTime);
      st.set({ isPlaying: false });
    };
  }, [projectId, setCurrentTime]);

  usePlayback(project?.duration ?? 0);

  const togglePlay = useCallback(() => {
    const st = useEditorStore.getState();
    const dur = useAppStore.getState().projects.find((p) => p.id === projectId)?.duration ?? 0;
    if (!st.isPlaying && st.currentTime >= dur - 0.01) st.set({ currentTime: 0 });
    st.set({ isPlaying: !st.isPlaying, rate: 1 });
  }, [projectId]);

  const step = useCallback(
    (frames: number) => {
      const st = useEditorStore.getState();
      const p = useAppStore.getState().projects.find((x) => x.id === projectId);
      if (!p) return;
      st.set({ isPlaying: false, currentTime: Math.max(0, Math.min(p.duration, st.currentTime + frames / p.frameRate)) });
    },
    [projectId],
  );

  const onHotkey = useCallback(
    (e: HotkeyEvent) => {
      const st = useEditorStore.getState();
      const p = useAppStore.getState().projects.find((x) => x.id === projectId);
      if (!p) return;
      const k = e.key.toLowerCase();
      const handled = () => e.preventDefault();
      if (e.meta && k === "z") {
        handled();
        if (e.shift) actions.redo();
        else actions.undo();
        return;
      }
      if (e.meta && k === "y") {
        handled();
        actions.redo();
        return;
      }
      if (e.meta) return;
      switch (k) {
        case " ":
          handled();
          togglePlay();
          break;
        case "s":
          actions.splitAtPlayhead();
          break;
        case "v":
          st.set({ tool: "select" });
          break;
        case "b":
          st.set({ tool: st.tool === "blade" ? "select" : "blade" });
          break;
        case "z":
          actions.undo();
          break;
        case "delete":
        case "backspace":
          handled();
          actions.deleteSelected();
          break;
        case "j":
          st.set({ isPlaying: true, rate: st.rate < 0 ? Math.max(-8, st.rate * 2) : -1 });
          break;
        case "k":
          st.set({ isPlaying: false, rate: 1 });
          break;
        case "l":
          st.set({ isPlaying: true, rate: st.rate > 0 && st.isPlaying ? Math.min(8, st.rate * 2) : 1 });
          break;
        case "arrowleft":
          handled();
          step(e.shift ? -p.frameRate : -1);
          break;
        case "arrowright":
          handled();
          step(e.shift ? p.frameRate : 1);
          break;
        case "home":
          handled();
          st.set({ currentTime: 0, isPlaying: false });
          break;
        case "end":
          handled();
          st.set({ currentTime: p.duration, isPlaying: false });
          break;
        case "+":
        case "=":
          st.set({ zoom: Math.min(12, st.zoom * 1.25) });
          break;
        case "-":
        case "_":
          st.set({ zoom: Math.max(0.25, st.zoom / 1.25) });
          break;
        case "i":
          actions.setInOut("in");
          break;
        case "o":
          actions.setInOut("out");
          break;
        case "escape":
          st.set({ selectedClipId: null });
          break;
        default:
          break;
      }
    },
    [actions, projectId, step, togglePlay],
  );
  useHotkeys(onHotkey, !!project);

  const goExport = useCallback(() => {
    if (!projectId) return;
    useEditorStore.getState().set({ isPlaying: false });
    router.push({ pathname: "/export", params: { id: projectId } });
  }, [projectId, router]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [router]);

  const onRename = useCallback((t: string) => renameProject(projectId, t), [projectId, renameProject]);
  const onFormat = useCallback(
    (ar: AspectRatio) => {
      setProjectFormat(projectId, ar);
      showToast(`Canvas set to ${ar}`, "success");
    },
    [projectId, setProjectFormat, showToast],
  );

  if (!hydrated) return <LoadingState label="Opening timeline…" />;
  if (!project) {
    return (
      <MessageState
        icon="film-outline"
        title="Project not found"
        message="This project may have been deleted or the link is out of date."
        actionLabel="Back to Projects"
        onAction={() => router.replace("/")}
      />
    );
  }

  const topBar = (
    <EditorTopBar
      project={project}
      actions={actions}
      compact={!wide}
      onBack={goBack}
      onExport={goExport}
      onShortcuts={() => router.push("/shortcuts")}
      onRename={onRename}
      onFormat={onFormat}
    />
  );

  if (wide) {
    const timelineH = Math.max(300, Math.min(420, height * 0.4));
    return (
      <View style={[s.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 }]}>
        {topBar}
        <View style={s.workspace}>
          <View style={s.sidePanel}>
            <MediaBin project={project} actions={actions} notify={showToast} showRail />
          </View>
          <View style={s.center}>
            <CanvasPreview project={project} userMedia={userMedia} maxCanvasHeight={Math.max(180, height - timelineH - 260)} onTogglePlay={togglePlay} onStep={step} />
          </View>
          <View style={s.sidePanel}>
            <Inspector project={project} actions={actions} />
          </View>
        </View>
        <View style={{ height: timelineH }}>
          <ScrollView style={s.flex} contentContainerStyle={s.flexGrow}>
            <Timeline project={project} userMedia={userMedia} actions={actions} compact={false} />
          </ScrollView>
        </View>
        {toastNode}
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={[s.narrow, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        {topBar}
        <CanvasPreview project={project} userMedia={userMedia} maxCanvasHeight={Math.min(420, height * 0.36)} onTogglePlay={togglePlay} onStep={step} />
        <Timeline project={project} userMedia={userMedia} actions={actions} compact={compact} />
        <Segmented
          options={[
            { value: "media", label: "Media & Effects" },
            { value: "inspector", label: "Clip Inspector" },
          ]}
          value={panel}
          onChange={setPanel}
          variant="joined"
          accessibilityLabel="Editor panel"
        />
        <View style={s.narrowPanel}>
          {panel === "media" ? (
            <MediaBin project={project} actions={actions} notify={showToast} showRail={width >= 420} />
          ) : (
            <Inspector project={project} actions={actions} />
          )}
        </View>
      </ScrollView>
      {toastNode}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 10, gap: 10 },
  workspace: { flex: 1, flexDirection: "row", gap: 10, minHeight: 0 },
  sidePanel: { width: 300 },
  center: { flex: 1 },
  flex: { flex: 1 },
  flexGrow: { flexGrow: 1 },
  narrow: { gap: 10 },
  narrowPanel: { height: 560 },
}));
