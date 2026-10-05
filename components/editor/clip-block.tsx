import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useDrag } from "@/hooks/use-drag";
import { lutById } from "@/constants/media";
import { Fonts } from "@/constants/Typography";
import type { Clip, MediaAsset, Track, WaveformDetail } from "@/store/types";
import { formatDb } from "@/utils/timecode";
import { sourceFor } from "./composite-frame";
import { Waveform } from "./waveform";

export type DragMode = "move" | "in" | "out";

export interface ClipGestureHandlers {
  onGrant: (clip: Clip, mode: DragMode, locationX: number) => void;
  onMove: (dx: number, dy: number) => void;
  onEnd: () => void;
}

interface Props {
  clip: Clip;
  track: Track;
  top: number;
  height: number;
  pps: number;
  selected: boolean;
  detail: WaveformDetail;
  userMedia: MediaAsset[];
  handlers: ClipGestureHandlers;
}

const HANDLE_W = 16;

function ClipBlockBase({ clip, track, top, height, pps, selected, detail, userMedia, handlers }: Props) {
  const bind = (mode: DragMode) => ({
    onStart: ({ locationX }: { locationX: number }) => handlers.onGrant(clip, mode, locationX),
    onMove: handlers.onMove,
    onEnd: handlers.onEnd,
  });
  const body = useDrag(bind("move"));
  const inHandle = useDrag(bind("in"));
  const outHandle = useDrag(bind("out"));
  const width = Math.max(4, clip.duration * pps);
  const left = clip.startTime * pps;
  const color = track.color;
  const isAudio = clip.type === "audio";
  const isText = clip.type === "text";
  const src = !isAudio && !isText ? sourceFor(clip.mediaId, userMedia) : null;
  const tileW = height * 1.45;
  const tiles = src ? Math.min(14, Math.max(1, Math.ceil(width / tileW))) : 0;
  const tileOffsets = useMemo(() => {
    const out: number[] = [];
    for (let x = 0; x < tiles; x++) out.push(Math.round(x * tileW));
    return out;
  }, [tiles, tileW]);
  const lut = lutById(clip.filter);
  const dim = track.isMuted || clip.isMuted;

  return (
    <View
      accessibilityLabel={`${clip.title} clip on ${track.label}, ${clip.duration.toFixed(1)} seconds${selected ? ", selected" : ""}`}
      style={[
        styles.clip,
        {
          left,
          top: top + 4,
          width,
          height: height - 8,
          backgroundColor: isText ? "rgba(245,158,11,0.32)" : isAudio ? `${color}2E` : `${color}40`,
          borderColor: selected ? "#22D3EE" : `${color}CC`,
          borderWidth: selected ? 2 : 1,
          opacity: dim ? 0.45 : 1,
        },
        selected && styles.selectedGlow,
      ]}
      {...body}
    >
      <View pointerEvents="none" style={styles.content}>
        {src ? (
          <View style={styles.tiles}>
            {tileOffsets.map((x) => (
              <Image key={`${clip.id}-${x}`} source={src} style={[styles.tile, { width: tileW }]} contentFit="cover" />
            ))}
            {track.type === "overlay" ? <View style={[StyleSheet.absoluteFill, { backgroundColor: `${color}55` }]} /> : null}
          </View>
        ) : null}
        {isAudio ? (
          <View style={styles.wave}>
            <Waveform
              seed={clip.mediaId}
              width={width - 4}
              height={height - 14}
              inPoint={clip.inPoint}
              sourceSpan={clip.outPoint - clip.inPoint}
              color={color}
              detail={detail}
              gain={clip.volume * track.volume}
            />
          </View>
        ) : null}
        <View style={styles.labelRow}>
          {isText ? (
            <View style={styles.tBadge}>
              <Text style={styles.tBadgeText}>T</Text>
            </View>
          ) : null}
          {isAudio && width > 44 ? (
            <View style={styles.dbBadge}>
              <Text style={styles.dbText}>{clip.isMuted ? "MUTE" : formatDb(clip.volume)}</Text>
            </View>
          ) : null}
          {width > 60 ? (
            <Text numberOfLines={1} style={[styles.title, isText && styles.textTitle]}>
              {isText ? clip.textProperties?.content ?? clip.title : clip.title}
            </Text>
          ) : null}
        </View>
        <View style={styles.badges}>
          {clip.speed !== 1 && width > 40 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{clip.speed}x</Text>
            </View>
          ) : null}
          {clip.reverse && width > 40 ? <Ionicons name="play-back" size={10} color="#fff" /> : null}
          {clip.filter !== "none" ? <View style={[styles.lutDot, { backgroundColor: lut.swatch[1], borderColor: lut.swatch[0] }]} /> : null}
        </View>
        {clip.transition !== "none" ? (
          <View style={styles.transition}>
            <Ionicons name="git-compare-outline" size={9} color="#0D0F12" />
          </View>
        ) : null}
      </View>
      {selected && !track.isLocked ? (
        <>
          <View
            accessibilityRole="adjustable"
            accessibilityLabel="Trim in-point handle"
            style={[styles.handleHit, { left: -HANDLE_W / 2 + 1 }]}
            {...inHandle}
          >
            <View pointerEvents="none" style={styles.handle} />
          </View>
          <View
            accessibilityRole="adjustable"
            accessibilityLabel="Trim out-point handle"
            style={[styles.handleHit, { right: -HANDLE_W / 2 + 1 }]}
            {...outHandle}
          >
            <View pointerEvents="none" style={styles.handle} />
          </View>
        </>
      ) : null}
    </View>
  );
}

export const ClipBlock = ClipBlockBase;

const styles = StyleSheet.create({
  clip: { position: "absolute", borderRadius: 6, overflow: "visible", cursor: "pointer" },
  selectedGlow: { boxShadow: "0 0 0 2px rgba(99,102,241,0.55), 0 0 14px rgba(34,211,238,0.55)", zIndex: 5 },
  content: { ...StyleSheet.absoluteFill, borderRadius: 5, overflow: "hidden" },
  tiles: { ...StyleSheet.absoluteFill, flexDirection: "row", opacity: 0.92 },
  tile: { height: "100%", borderRightWidth: 1, borderColor: "rgba(0,0,0,0.35)" },
  wave: { position: "absolute", left: 2, right: 2, top: 5, bottom: 5 },
  labelRow: { position: "absolute", left: 4, top: 3, right: 4, flexDirection: "row", alignItems: "center", gap: 5 },
  title: {
    flexShrink: 1,
    fontFamily: Fonts.semiBold,
    fontSize: 10,
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowRadius: 3,
  },
  textTitle: { fontSize: 11, marginTop: 5 },
  tBadge: { width: 18, height: 18, borderRadius: 4, backgroundColor: "#F59E0B", alignItems: "center", justifyContent: "center", marginTop: 5 },
  tBadgeText: { fontFamily: Fonts.bold, fontSize: 11, color: "#1D212A" },
  dbBadge: { backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  dbText: { fontFamily: Fonts.monoMedium, fontSize: 9, color: "#fff" },
  badges: { position: "absolute", right: 4, bottom: 3, flexDirection: "row", alignItems: "center", gap: 4 },
  badge: { backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 3, paddingHorizontal: 3 },
  badgeText: { fontFamily: Fonts.monoBold, fontSize: 9, color: "#22D3EE" },
  lutDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 2 },
  transition: { position: "absolute", left: 0, bottom: 0, width: 14, height: 14, backgroundColor: "#E0E7FF", borderTopRightRadius: 6, alignItems: "center", justifyContent: "center" },
  handleHit: { position: "absolute", top: -2, bottom: -2, width: HANDLE_W, alignItems: "center", justifyContent: "center", zIndex: 10, cursor: "pointer" },
  handle: { width: 7, height: "70%", maxHeight: 22, borderRadius: 4, backgroundColor: "#F8FAFC", boxShadow: "0 0 6px rgba(0,0,0,0.6)" },
});
