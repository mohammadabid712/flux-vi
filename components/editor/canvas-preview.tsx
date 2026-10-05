import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRef, useState } from "react";
import { type LayoutChangeEvent, Modal, Pressable, Text, View } from "react-native";
import { useDrag } from "@/hooks/use-drag";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { aspectValue } from "@/constants/presets";
import { Fonts } from "@/constants/Typography";
import { makeStyles } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useEditorStore } from "@/store/editor-store";
import type { MediaAsset, Project } from "@/store/types";
import { computeAudio } from "@/utils/composite";
import { toTimecode } from "@/utils/timecode";
import { CompositeFrame, sourceFor } from "./composite-frame";

interface Props {
  project: Project;
  userMedia: MediaAsset[];
  maxCanvasHeight: number;
  onTogglePlay: () => void;
  onStep: (frames: number) => void;
}

function CtrlButton({ icon, label, onPress, active, big }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void; active?: boolean; big?: boolean }) {
  const { theme, colors } = useTheme();
  const s = useStyles(theme);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }} hitSlop={8}>
      <View style={[s.ctrl, big && s.ctrlBig]}>
        <Ionicons name={icon} size={big ? 20 : 18} color={active ? colors.cyan : colors.text} />
      </View>
    </Pressable>
  );
}

function Filmstrip({ project, userMedia }: { project: Project; userMedia: MediaAsset[] }) {
  const { theme } = useTheme();
  const s = useStyles(theme);
  const time = useEditorStore((st) => st.currentTime);
  const [w, setW] = useState(0);
  const startX = useRef(0);
  const main = project.tracks.find((t) => t.type === "video") ?? project.tracks[0];
  const duration = Math.max(project.duration, 0.001);
  const seek = (x: number, pause: boolean) => {
    if (w <= 0) return;
    const t = Math.max(0, Math.min(project.duration, (x / w) * project.duration));
    useEditorStore.getState().set(pause ? { currentTime: t, isPlaying: false } : { currentTime: t });
  };
  const drag = useDrag({
    onStart: ({ locationX }) => {
      startX.current = locationX;
      seek(locationX, true);
    },
    onMove: (dx) => seek(startX.current + dx, false),
  });

  return (
    <View
      style={s.strip}
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      accessibilityRole="adjustable"
      accessibilityLabel="Preview scrubber"
      {...drag}
    >
      <View pointerEvents="none" style={s.stripInner}>
        {main?.clips.map((c) => {
          const src = sourceFor(c.mediaId, userMedia);
          return (
            <View key={c.id} style={[s.stripClip, { left: `${(c.startTime / duration) * 100}%`, width: `${(c.duration / duration) * 100}%` }]}>
              {src ? <Image source={src} style={s.fill} contentFit="cover" /> : null}
            </View>
          );
        })}
      </View>
      <View pointerEvents="none" style={[s.stripHead, { left: `${(time / duration) * 100}%` }]}>
        <View style={s.stripKnob} />
      </View>
    </View>
  );
}

function AudioMeters({ project, time }: { project: Project; time: number }) {
  const { theme, colors } = useTheme();
  const s = useStyles(theme);
  const levels = computeAudio(project.tracks, time);
  if (levels.length === 0) return null;
  return (
    <View style={s.meters} accessibilityLabel="Audio level meters">
      {levels.map((l) => {
        const track = project.tracks.find((t) => t.id === l.trackId);
        return (
          <View key={l.trackId} style={s.meterRow}>
            <Text style={s.meterLabel}>{track?.label}</Text>
            <View style={s.meterTrack}>
              <View style={[s.meterFill, { width: `${Math.round(l.level * 100)}%`, backgroundColor: l.level > 0.9 ? colors.red : track?.color ?? colors.green }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function CanvasPreview({ project, userMedia, maxCanvasHeight, onTogglePlay, onStep }: Props) {
  const { theme, colors } = useTheme();
  const s = useStyles(theme);
  const insets = useSafeAreaInsets();
  const time = useEditorStore((st) => st.currentTime);
  const isPlaying = useEditorStore((st) => st.isPlaying);
  const loop = useEditorStore((st) => st.loop);
  const speedPreset = useEditorStore((st) => st.speedPreset);
  const rate = useEditorStore((st) => st.rate);
  const showGuides = useEditorStore((st) => st.showGuides);
  const setEditor = useEditorStore((st) => st.set);
  const [box, setBox] = useState({ w: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [fsBox, setFsBox] = useState({ w: 0, h: 0 });

  const ar = aspectValue(project.aspectRatio);
  const fitBox = (w: number, h: number) => {
    let cw = w;
    let ch = cw / ar;
    if (ch > h) {
      ch = h;
      cw = ch * ar;
    }
    return { cw: Math.floor(cw), ch: Math.floor(ch) };
  };
  const { cw, ch } = fitBox(box.w, maxCanvasHeight);
  const fs = fitBox(fsBox.w, fsBox.h);

  const cycleSpeed = () => setEditor({ speedPreset: speedPreset === 1 ? 1.5 : speedPreset === 1.5 ? 2 : 1 });
  const shuttle = rate !== 1 ? `${rate > 0 ? "▶▶" : "◀◀"} ${Math.abs(rate)}x` : null;

  const controls = (
    <View style={s.controls}>
      <CtrlButton icon="play-skip-back" label="Step back one frame" onPress={() => onStep(-1)} />
      <Pressable onPress={onTogglePlay} accessibilityRole="button" accessibilityLabel={isPlaying ? "Pause" : "Play"} hitSlop={8}>
        <View style={s.playBtn}>
          <Ionicons name={isPlaying ? "pause" : "play"} size={20} color={colors.text} style={!isPlaying && { marginLeft: 2 }} />
        </View>
      </Pressable>
      <CtrlButton icon="play-skip-forward" label="Step forward one frame" onPress={() => onStep(1)} />
      <View style={s.ctrlSpacer} />
      <CtrlButton icon="repeat" label="Loop playback" active={loop} onPress={() => setEditor({ loop: !loop })} />
      <Pressable onPress={cycleSpeed} accessibilityRole="button" accessibilityLabel={`Playback speed ${speedPreset}x`} hitSlop={8}>
        <View style={s.speedPill}>
          <Text style={s.speedText}>{speedPreset}x</Text>
        </View>
      </Pressable>
      <CtrlButton icon="grid-outline" label="Safe area guides" active={showGuides} onPress={() => setEditor({ showGuides: !showGuides })} />
      <CtrlButton icon={fullscreen ? "contract" : "expand"} label={fullscreen ? "Exit full screen" : "Full screen"} onPress={() => setFullscreen((f) => !f)} />
    </View>
  );

  return (
    <View style={s.root}>
      <View style={s.stage} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width })}>
        {cw > 0 ? (
          <View style={[s.canvasShadow, { width: cw, height: ch }]}>
            <CompositeFrame tracks={project.tracks} time={time} width={cw} height={ch} userMedia={userMedia} showGuides={showGuides} />
          </View>
        ) : (
          <View style={{ height: maxCanvasHeight * 0.6 }} />
        )}
      </View>
      <View style={s.tcRow}>
        <Text style={s.timecode} selectable>
          {toTimecode(time, project.frameRate)} <Text style={s.tcTotal}>/ {toTimecode(project.duration, project.frameRate)}</Text>
        </Text>
        {shuttle ? <Text style={s.shuttle}>{shuttle}</Text> : null}
        <AudioMeters project={project} time={time} />
      </View>
      {controls}
      <Filmstrip project={project} userMedia={userMedia} />

      <Modal visible={fullscreen} animationType="fade" onRequestClose={() => setFullscreen(false)}>
        <View style={[s.fsRoot, { paddingTop: insets.top, paddingBottom: insets.bottom + 8 }]}>
          <View style={s.fsStage} onLayout={(e) => setFsBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
            {fs.cw > 0 ? (
              <CompositeFrame tracks={project.tracks} time={time} width={fs.cw} height={fs.ch} userMedia={userMedia} showGuides={showGuides} />
            ) : null}
          </View>
          <View style={s.fsBar}>
            <Text style={s.timecode}>{toTimecode(time, project.frameRate)}</Text>
            {controls}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 10, gap: 8 },
  stage: { backgroundColor: c.canvas, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingVertical: 8, overflow: "hidden" },
  canvasShadow: { boxShadow: "0 10px 30px rgba(0,0,0,0.6)" },
  tcRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2 },
  timecode: { fontFamily: Fonts.monoMedium, fontSize: 12, color: c.text, fontVariant: ["tabular-nums"] },
  tcTotal: { color: c.muted, fontFamily: Fonts.mono },
  shuttle: { fontFamily: Fonts.monoBold, fontSize: 11, color: c.cyan },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  ctrl: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  ctrlBig: { width: 40, height: 40 },
  ctrlSpacer: { width: 10 },
  playBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: c.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.primarySoft,
    boxShadow: "0 0 14px rgba(99,102,241,0.5)",
  },
  speedPill: { height: 26, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  speedText: { fontFamily: Fonts.monoMedium, fontSize: 11, color: c.text },
  strip: { height: 38, borderRadius: 6, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, overflow: "visible", justifyContent: "center" },
  stripInner: { ...{ position: "absolute" as const, left: 4, right: 4, top: 4, bottom: 4 }, borderRadius: 4, overflow: "hidden" },
  stripClip: { position: "absolute", top: 0, bottom: 0, borderRightWidth: 1, borderColor: "#000", overflow: "hidden" },
  fill: { width: "100%", height: "100%" },
  stripHead: { position: "absolute", top: -6, bottom: -6, width: 2, marginLeft: -1, backgroundColor: c.primary, alignItems: "center" },
  stripKnob: { width: 10, height: 10, borderRadius: 2, backgroundColor: c.primary, marginTop: -2, transform: [{ rotate: "45deg" }] },
  meters: { gap: 2, width: 96 },
  meterRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  meterLabel: { fontFamily: Fonts.monoBold, fontSize: 8, color: c.muted, width: 14 },
  meterTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: c.border, overflow: "hidden" },
  meterFill: { height: 4, borderRadius: 2 },
  fsRoot: { flex: 1, backgroundColor: "#000" },
  fsStage: { flex: 1, alignItems: "center", justifyContent: "center" },
  fsBar: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
}));
