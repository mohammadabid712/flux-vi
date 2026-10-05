import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { type GestureResponderEvent, Pressable, ScrollView, Text, View } from "react-native";
import { useDrag } from "@/hooks/use-drag";
import { Fonts } from "@/constants/Typography";
import { makeStyles } from "@/constants/theme";
import type { EditorActions } from "@/hooks/use-editor-actions";
import { useTheme } from "@/hooks/use-theme";
import { useEditorStore } from "@/store/editor-store";
import type { Clip, MediaAsset, Project, Track } from "@/store/types";
import { useAppStore } from "@/store/useAppStore";
import { toRulerLabel } from "@/utils/timecode";
import { clipEnd, moveClip, snapCandidates, snapTime, trimClip } from "@/utils/timeline";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import { ClipBlock, type ClipGestureHandlers, type DragMode } from "./clip-block";

export const BASE_PPS = 8;
const TRACK_H = 50;
const RULER_H = 30;

interface Props {
  project: Project;
  userMedia: MediaAsset[];
  actions: EditorActions;
  compact: boolean;
}

const TICKS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];

function Playhead({ pps, height }: { pps: number; height: number }) {
  const { theme } = useTheme();
  const s = useStyles(theme);
  const time = useEditorStore((st) => st.currentTime);
  return (
    <View pointerEvents="none" style={[s.playhead, { left: time * pps - 1, height }]}>
      <View style={s.playKnob} />
    </View>
  );
}

const Ruler = memo(function Ruler({ pps, width, duration }: { pps: number; width: number; duration: number }) {
  const { theme } = useTheme();
  const s = useStyles(theme);
  const major = TICKS.find((t) => t * pps >= 84) ?? 600;
  const minor = major / 5;
  const count = Math.ceil(width / (minor * pps));
  const ticks = [];
  for (let i = 0; i <= count; i++) {
    const t = i * minor;
    const isMajor = i % 5 === 0;
    ticks.push(
      <View key={i} style={[s.tick, { left: t * pps, height: isMajor ? 10 : 5, opacity: t > duration + 0.01 ? 0.4 : 1 }]}>
        {isMajor ? <Text style={s.tickLabel}>{toRulerLabel(t)}</Text> : null}
      </View>,
    );
  }
  return <View pointerEvents="none" style={[s.ruler, { width }]}>{ticks}</View>;
});

function TrackHeader({ track, selected, compact, onSelect, onToggle }: { track: Track; selected: boolean; compact: boolean; onSelect: (id: string) => void; onToggle: (t: Track, field: "isMuted" | "isLocked" | "isSolo") => void }) {
  const { theme, colors } = useTheme();
  const s = useStyles(theme);
  const audio = track.type === "audio";
  return (
      <View style={[s.header, selected && { backgroundColor: colors.hover }]}>
        <View style={[s.headerAccent, { backgroundColor: track.color }]} />
        <Pressable onPress={() => onSelect(track.id)} accessibilityRole="button" accessibilityLabel={`Select track ${track.label} ${track.name}`} accessibilityState={{ selected }} style={s.headerSelect}>
          <Text style={[s.trackLabel, { color: track.color }]}>{track.label}</Text>
          {!compact ? <Text numberOfLines={1} style={s.trackName}>{track.name}</Text> : null}
        </Pressable>
        {audio ? (
          <Pressable onPress={() => onToggle(track, "isSolo")} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Solo ${track.label}`} accessibilityState={{ selected: track.isSolo }}>
            <View style={[s.soloBtn, track.isSolo && { backgroundColor: colors.amber, borderColor: colors.amber }]}>
              <Text style={[s.soloText, track.isSolo && { color: "#111" }]}>S</Text>
            </View>
          </Pressable>
        ) : null}
        <Pressable onPress={() => onToggle(track, "isMuted")} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${audio ? "Mute" : "Hide"} ${track.label}`} accessibilityState={{ selected: track.isMuted }}>
          <View style={s.iconBtn}>
            <Ionicons
              name={audio ? (track.isMuted ? "volume-mute" : "volume-medium-outline") : track.isMuted ? "eye-off-outline" : "eye-outline"}
              size={15}
              color={track.isMuted ? colors.red : colors.muted}
            />
          </View>
        </Pressable>
        <Pressable onPress={() => onToggle(track, "isLocked")} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Lock ${track.label}`} accessibilityState={{ selected: track.isLocked }}>
          <View style={s.iconBtn}>
            <Ionicons name={track.isLocked ? "lock-closed" : "lock-open-outline"} size={14} color={track.isLocked ? colors.amber : colors.muted} />
          </View>
        </Pressable>
      </View>
  );
}

function ToolBtn({ icon, label, hint, active, onPress, mci }: { icon: string; label: string; hint: string; active?: boolean; onPress: () => void; mci?: boolean }) {
  const { theme, colors } = useTheme();
  const s = useStyles(theme);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }} hitSlop={4}>
      <View style={[s.tool, active && s.toolActive]}>
        {mci ? (
          <MaterialCommunityIcons name={icon as never} size={16} color={active ? "#fff" : colors.text} />
        ) : (
          <Ionicons name={icon as never} size={16} color={active ? "#fff" : colors.text} />
        )}
        <Text style={[s.toolKey, active && { color: "#fff" }]}>{hint}</Text>
      </View>
    </Pressable>
  );
}

function TimelineBase({ project, userMedia, actions, compact }: Props) {
  const { theme, colors } = useTheme();
  const s = useStyles(theme);
  const zoom = useEditorStore((st) => st.zoom);
  const snap = useEditorStore((st) => st.snap);
  const ripple = useEditorStore((st) => st.ripple);
  const tool = useEditorStore((st) => st.tool);
  const selectedClipId = useEditorStore((st) => st.selectedClipId);
  const selectedTrackId = useEditorStore((st) => st.selectedTrackId);
  const lastAction = useEditorStore((st) => st.lastAction);
  const setEditor = useEditorStore((st) => st.set);
  const settings = useAppStore((st) => st.settings);
  const edit = useAppStore((st) => st.edit);
  const endLiveEdit = useAppStore((st) => st.endLiveEdit);

  const pps = BASE_PPS * zoom;
  const tracks = project.tracks;
  const [viewW, setViewW] = useState(0);
  const contentW = Math.max(viewW, (project.duration + 20) * pps);
  const lanesH = tracks.length * TRACK_H;
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(0);

  // Follow the playhead while playing.
  useEffect(
    () =>
      useEditorStore.subscribe((st, prev) => {
        if (!st.isPlaying || st.currentTime === prev.currentTime || viewW <= 0) return;
        const x = st.currentTime * BASE_PPS * st.zoom;
        if (x > scrollX.current + viewW - 40 || x < scrollX.current) {
          scrollRef.current?.scrollTo({ x: Math.max(0, x - 60), animated: false });
        }
      }),
    [viewW],
  );

  // ---- clip drag / trim (live edits from a snapshot, committed on release) ----
  const drag = useRef<{ clip: Clip; mode: DragMode; snapshot: Track[]; trackIndex: number; moved: boolean; label: string } | null>(null);
  const c = { pps, snap, tracks, tool, settings, projectId: project.id };

  const handlers: ClipGestureHandlers = {
    onGrant: (clip, mode, locationX) => {
      const trackIndex = c.tracks.findIndex((t) => t.id === clip.trackId);
      const track = c.tracks[trackIndex];
      setEditor({ selectedClipId: clip.id, selectedTrackId: clip.trackId });
      if (c.tool === "blade" && mode === "move") {
        actions.splitAt(clip.id, clip.startTime + locationX / c.pps);
        drag.current = null;
        return;
      }
      if (track?.isLocked) {
        drag.current = null;
        return;
      }
      drag.current = {
        clip,
        mode,
        snapshot: c.tracks,
        trackIndex,
        moved: false,
        label: mode === "move" ? "Move Clip" : mode === "in" ? "Trim In-Point" : "Trim Out-Point",
      };
    },
    onMove: (dx, dy) => {
      const d = drag.current;
      if (!d) return;
      if (!d.moved && Math.abs(dx) < 3 && Math.abs(dy) < 6) return;
      d.moved = true;
      const tol = c.snap ? c.settings.snapTolerance / c.pps : 0;
      const playhead = useEditorStore.getState().currentTime;
      const cands = snapCandidates(d.snapshot, d.clip.id, playhead);
      const delta = dx / c.pps;
      if (d.mode === "move") {
        let start = Math.max(0, d.clip.startTime + delta);
        if (tol > 0) {
          const snappedStart = snapTime(start, cands, tol);
          const snappedEnd = snapTime(start + d.clip.duration, cands, tol) - d.clip.duration;
          start = snappedStart !== start ? snappedStart : snappedEnd !== start ? snappedEnd : start;
        }
        const idx = Math.max(0, Math.min(d.snapshot.length - 1, d.trackIndex + Math.round(dy / TRACK_H)));
        const target = d.snapshot[idx];
        edit(c.projectId, d.label, () => moveClip(d.snapshot, d.clip.id, start, target.id), "live");
      } else {
        const edgeTime = d.mode === "in" ? d.clip.startTime + delta : clipEnd(d.clip) + delta;
        const snapped = tol > 0 ? snapTime(edgeTime, cands, tol) : edgeTime;
        const realDelta = snapped - (d.mode === "in" ? d.clip.startTime : clipEnd(d.clip));
        edit(c.projectId, d.label, () => trimClip(d.snapshot, d.clip.id, d.mode === "in" ? "in" : "out", realDelta), "live");
      }
    },
    onEnd: () => {
      const d = drag.current;
      drag.current = null;
      if (!d?.moved) return;
      endLiveEdit(c.projectId, d.label);
      setEditor({ lastAction: d.label });
    },
  };

  // ---- ruler scrubbing ----
  const scrubStart = useRef(0);
  const setTimeFromX = (x: number) => {
    let t = Math.max(0, x / pps);
    if (snap) t = snapTime(t, snapCandidates(tracks, null, -1), settings.snapTolerance / pps);
    useEditorStore.getState().set({ currentTime: Math.min(t, project.duration) });
  };
  const scrub = useDrag({
    onStart: ({ locationX }) => {
      scrubStart.current = locationX;
      useEditorStore.getState().set({ isPlaying: false });
      setTimeFromX(locationX);
    },
    onMove: (dx) => setTimeFromX(scrubStart.current + dx),
  });

  const onLanePress = (trackId: string, e: GestureResponderEvent) => {
    setEditor({ selectedClipId: null, selectedTrackId: trackId });
    setTimeFromX(e.nativeEvent.locationX);
  };

  const onToggleTrack = useCallback(
    (t: Track, field: "isMuted" | "isLocked" | "isSolo") => {
      const label = field === "isMuted" ? (t.type === "audio" ? "Mute Track" : "Hide Track") : field === "isLocked" ? "Lock Track" : "Solo Track";
      actions.updateTrack(t.id, label, { [field]: !t[field] });
    },
    [actions],
  );

  const onSelectTrack = useCallback((id: string) => setEditor({ selectedTrackId: id, selectedClipId: null }), [setEditor]);

  const zoomLog = Math.log2(zoom);
  const headerW = compact ? 128 : 176;

  return (
    <View style={s.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.toolbarScroll} contentContainerStyle={s.toolbar}>
        <ToolBtn icon="navigate-outline" label="Selection tool" hint="V" active={tool === "select"} onPress={() => setEditor({ tool: "select" })} />
        <ToolBtn icon="cut-outline" label="Split clip at playhead" hint="S" onPress={actions.splitAtPlayhead} />
        <ToolBtn icon="box-cutter" mci label="Blade tool" hint="B" active={tool === "blade"} onPress={() => setEditor({ tool: tool === "blade" ? "select" : "blade" })} />
        <ToolBtn icon="trash-outline" label="Delete selected clip" hint="Del" onPress={actions.deleteSelected} />
        <View style={s.toggleGroup}>
          <Text style={s.toggleLabel}>Ripple Delete</Text>
          <Toggle value={ripple} onChange={(v) => setEditor({ ripple: v })} accessibilityLabel="Ripple delete" size="sm" />
        </View>
        <View style={s.toggleGroup}>
          <Text style={s.toggleLabel}>Snap to Grid</Text>
          <Toggle value={snap} onChange={(v) => setEditor({ snap: v })} accessibilityLabel="Snap to grid" size="sm" />
        </View>
        <Pressable onPress={() => actions.addTrack("video")} accessibilityRole="button" accessibilityLabel="Add video track" hitSlop={4}>
          <View style={s.addBtn}>
            <Ionicons name="add" size={16} color={colors.text} />
            <Text style={s.addText}>Video</Text>
          </View>
        </Pressable>
        <Pressable onPress={() => actions.addTrack("audio")} accessibilityRole="button" accessibilityLabel="Add audio track" hitSlop={4}>
          <View style={s.addBtn}>
            <Ionicons name="add" size={16} color={colors.text} />
            <Text style={s.addText}>Audio</Text>
          </View>
        </Pressable>
        <View style={s.zoomGroup}>
          <Pressable onPress={() => setEditor({ zoom: Math.max(0.25, zoom / 1.5) })} accessibilityRole="button" accessibilityLabel="Zoom out timeline" hitSlop={6}>
            <Ionicons name="remove" size={16} color={colors.muted} />
          </Pressable>
          <View style={s.zoomSlider}>
            <Slider
              value={zoomLog}
              min={-2}
              max={3.6}
              step={0.05}
              color={colors.video1}
              trackColor={colors.border}
              accessibilityLabel="Timeline zoom"
              onChange={(v) => setEditor({ zoom: 2 ** v })}
            />
          </View>
          <Pressable onPress={() => setEditor({ zoom: Math.min(12, zoom * 1.5) })} accessibilityRole="button" accessibilityLabel="Zoom in timeline" hitSlop={6}>
            <Ionicons name="add" size={16} color={colors.muted} />
          </Pressable>
        </View>
        {lastAction ? (
          <View style={s.lastAction}>
            <Ionicons name="time-outline" size={12} color={colors.cyan} />
            <Text numberOfLines={1} style={s.lastActionText}>{lastAction}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={s.body}>
        <View style={[s.headers, { width: headerW }]}>
          <View style={[s.rulerSpacer, { height: RULER_H }]}>
            <Text style={s.trackCount}>{tracks.length} tracks</Text>
          </View>
          {tracks.map((t) => (
            <TrackHeader key={t.id} track={t} selected={t.id === selectedTrackId} compact={compact} onSelect={onSelectTrack} onToggle={onToggleTrack} />
          ))}
        </View>
        <ScrollView
          ref={scrollRef}
          horizontal
          style={s.lanesScroll}
          onLayout={(e) => setViewW(e.nativeEvent.layout.width)}
          onScroll={(e) => {
            scrollX.current = e.nativeEvent.contentOffset.x;
          }}
          scrollEventThrottle={32}
          showsHorizontalScrollIndicator
        >
          <View style={{ width: contentW, height: RULER_H + lanesH }}>
            <View style={{ height: RULER_H, width: contentW }}>
              <Ruler pps={pps} width={contentW} duration={project.duration} />
              <View
                style={s.scrubOverlay}
                accessibilityRole="adjustable"
                accessibilityLabel="Timecode ruler, drag to scrub"
                {...scrub}
              />
            </View>
            {tracks.map((t, i) => (
              <View
                key={t.id}
                style={[
                  s.lane,
                  { top: RULER_H + i * TRACK_H, width: contentW },
                  t.id === selectedTrackId && { backgroundColor: colors.hover },
                  t.isLocked && s.laneLocked,
                ]}
                onStartShouldSetResponder={() => true}
                onResponderRelease={(e) => onLanePress(t.id, e)}
              />
            ))}
            {tracks.length === 0 || tracks.every((t) => t.clips.length === 0) ? (
              <View pointerEvents="none" style={[s.emptyHint, { top: RULER_H + 8 }]}>
                <Text style={s.emptyText}>Tap media in the bin to append it to the timeline</Text>
              </View>
            ) : null}
            {tracks.flatMap((t, i) =>
              t.clips.map((c) => (
                <ClipBlock
                  key={c.id}
                  clip={c}
                  track={t}
                  top={RULER_H + i * TRACK_H}
                  height={TRACK_H}
                  pps={pps}
                  selected={c.id === selectedClipId}
                  detail={settings.waveformDetail}
                  userMedia={userMedia}
                  handlers={handlers}
                />
              )),
            )}
            <Playhead pps={pps} height={RULER_H + lanesH} />
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

export const Timeline = memo(TimelineBase);

const useStyles = makeStyles((c) => ({
  root: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  toolbarScroll: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: c.border },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 8 },
  tool: { flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel },
  toolActive: { backgroundColor: c.primary, borderColor: c.primary, boxShadow: "0 4px 12px rgba(99,102,241,0.4)" },
  toolKey: { fontFamily: Fonts.monoMedium, fontSize: 11, color: c.text },
  toggleGroup: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8 },
  toggleLabel: { fontFamily: Fonts.medium, fontSize: 12, color: c.muted },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 5, height: 32, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel },
  addText: { fontFamily: Fonts.medium, fontSize: 12, color: c.text },
  zoomGroup: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 6 },
  zoomSlider: { width: 96, height: 24, flexDirection: "row" },
  lastAction: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, height: 26, borderRadius: 6, backgroundColor: "rgba(6,182,212,0.1)", maxWidth: 220 },
  lastActionText: { fontFamily: Fonts.medium, fontSize: 11, color: c.cyan },
  body: { flexDirection: "row" },
  headers: { borderRightWidth: 1, borderRightColor: c.border, backgroundColor: c.surface },
  rulerSpacer: { justifyContent: "center", paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: c.border },
  trackCount: { fontFamily: Fonts.mono, fontSize: 10, color: c.subtle },
  header: { height: TRACK_H, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: c.border },
  headerAccent: { position: "absolute", left: 0, top: 8, bottom: 8, width: 2, borderRadius: 1 },
  headerSelect: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "stretch" },
  trackLabel: { fontFamily: Fonts.monoBold, fontSize: 12, width: 24 },
  trackName: { flex: 1, fontFamily: Fonts.medium, fontSize: 12, color: c.text },
  flex: { flex: 1 },
  iconBtn: { width: 22, height: 26, alignItems: "center", justifyContent: "center" },
  soloBtn: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  soloText: { fontFamily: Fonts.monoBold, fontSize: 9, color: c.muted },
  lanesScroll: { flex: 1, backgroundColor: c.bg },
  ruler: { position: "absolute", left: 0, top: 0, height: RULER_H, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.surface },
  tick: { position: "absolute", bottom: 0, width: 1, backgroundColor: c.subtle },
  tickLabel: { position: "absolute", bottom: 12, left: -26, width: 52, textAlign: "center", fontFamily: Fonts.mono, fontSize: 9.5, color: c.muted },
  scrubOverlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, cursor: "pointer" },
  lane: { position: "absolute", left: 0, height: TRACK_H, borderBottomWidth: 1, borderBottomColor: c.border },
  laneLocked: { backgroundColor: "rgba(245,158,11,0.05)" },
  emptyHint: { position: "absolute", left: 12 },
  emptyText: { fontFamily: Fonts.medium, fontSize: 12, color: c.subtle },
  playhead: { position: "absolute", top: 0, width: 2, backgroundColor: c.primary, alignItems: "center", zIndex: 20, boxShadow: "0 0 8px rgba(99,102,241,0.8)" },
  playKnob: { width: 12, height: 14, backgroundColor: c.primary, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, marginTop: 0 },
}));
