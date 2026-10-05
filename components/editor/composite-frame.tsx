import { Image } from "expo-image";
import { memo } from "react";
import { type ImageSourcePropType, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Artwork, findMedia, lutById } from "@/constants/media";
import { Fonts } from "@/constants/Typography";
import type { MediaAsset, Track } from "@/store/types";
import { computeFrame, cssFilterFor, type TextLayer, type VisualLayer } from "@/utils/composite";

interface Props {
  tracks: Track[];
  time: number;
  width: number;
  height: number;
  userMedia: MediaAsset[];
  showGuides?: boolean;
}

const supportsCssFilter = process.env.EXPO_OS !== "ios";

export const fontFor = (family: string | undefined): string =>
  family === "JetBrains Mono" ? Fonts.monoBold : family === "System" ? "System" : Fonts.extraBold;

export function sourceFor(mediaId: string, userMedia: MediaAsset[]): ImageSourcePropType | null {
  const m = findMedia(mediaId, userMedia);
  if (!m) return null;
  if (m.artwork) return Artwork[m.artwork];
  if (m.type === "image" && m.url) return { uri: m.url };
  if (m.thumbnailUrl) return { uri: m.thumbnailUrl };
  return null;
}

function Visual({ layer, width, height, userMedia, isBase }: { layer: VisualLayer; width: number; height: number; userMedia: MediaAsset[]; isBase: boolean }) {
  const { clip } = layer;
  const src = sourceFor(clip.mediaId, userMedia);
  const lut = lutById(clip.filter);
  const t = clip.transform;
  const pip = !isBase || t.scale < 0.98;
  const filter = cssFilterFor(clip, lut.css);
  const frameStyle: ViewStyle = {
    position: "absolute",
    left: 0,
    top: 0,
    width,
    height,
    opacity: layer.opacity,
    overflow: "hidden",
    borderRadius: pip ? Math.max(4, width * 0.012) : 0,
    borderWidth: pip ? 1.5 : 0,
    borderColor: "rgba(255,255,255,0.7)",
    transform: [
      { translateX: (t.posX + layer.offsetX) * width },
      { translateY: t.posY * height },
      { scale: t.scale * layer.extraScale },
      { rotate: `${t.rotation}deg` },
    ],
  };
  const glitchShift = layer.glitch > 0 ? Math.sin(layer.sourceTime * 90) * layer.glitch * width * 0.03 : 0;
  return (
    <View style={frameStyle} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, supportsCssFilter && filter ? ({ filter } as ViewStyle) : null]}>
        {src ? (
          <Image
            source={src}
            contentFit="cover"
            style={{
              width: "100%",
              height: "100%",
              transform: [
                { scale: layer.kenScale },
                { translateX: layer.kenX * width + glitchShift },
                { translateY: layer.kenY * height },
                ...(clip.reverse ? [{ scaleX: -1 }] : []),
              ],
            }}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.missing]}>
            <Text style={styles.missingText}>Media offline</Text>
          </View>
        )}
      </View>
      {lut.tintOpacity > 0 ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: lut.tint, opacity: lut.tintOpacity }]} />
      ) : null}
      {clip.filter === "cinematic" ? <View style={[StyleSheet.absoluteFill, styles.cinematicWarm]} /> : null}
      {clip.filter === "vintage" ? <View style={[StyleSheet.absoluteFill, styles.vhs]} /> : null}
      {!supportsCssFilter && clip.filter === "noir" ? <View style={[StyleSheet.absoluteFill, styles.noirIos]} /> : null}
      {layer.glitch > 0 ? (
        <>
          <View style={[styles.glitchBar, { top: `${(layer.sourceTime * 37) % 80}%`, backgroundColor: "rgba(236,72,153,0.45)", height: height * 0.06 }]} />
          <View style={[styles.glitchBar, { top: `${(layer.sourceTime * 53) % 90}%`, backgroundColor: "rgba(34,211,238,0.4)", height: height * 0.03 }]} />
        </>
      ) : null}
      {layer.dip > 0 ? <View style={[StyleSheet.absoluteFill, { backgroundColor: "#000", opacity: layer.dip }]} /> : null}
    </View>
  );
}

function Caption({ layer, width, height }: { layer: TextLayer; width: number; height: number }) {
  const p = layer.clip.textProperties;
  if (!p) return null;
  const k = Math.min(width, height) / 1080;
  const size = Math.max(8, p.fontSize * k * (height > width ? 1 : 1.25));
  const text = p.content.slice(0, layer.visibleChars);
  const t = layer.clip.transform;
  const wrapper: ViewStyle = {
    position: "absolute",
    left: 0,
    right: 0,
    opacity: layer.opacity,
    alignItems: "center",
    paddingHorizontal: width * 0.06,
    transform: [
      { translateX: t.posX * width },
      { translateY: t.posY * height + layer.translateY * k * 2 },
      { scale: layer.scale * t.scale },
      { rotate: `${t.rotation}deg` },
    ],
  };
  const family = fontFor(p.fontFamily);
  switch (p.style) {
    case "title":
      return (
        <View pointerEvents="none" style={[wrapper, { top: height * 0.32, alignItems: "flex-start", paddingHorizontal: width * 0.05 }]}>
          <Text style={[styles.title, { fontSize: size * 1.25, color: p.fontColor, fontFamily: family, textShadowRadius: size * 0.2 }]}>
            {text}
          </Text>
          {p.bgEnabled ? <View style={[styles.ribbon, { backgroundColor: p.bgColor, height: size * 0.35, width: size * 4 }]} /> : null}
        </View>
      );
    case "lower":
      return (
        <View pointerEvents="none" style={[wrapper, { bottom: height * 0.1, alignItems: "flex-start", paddingHorizontal: width * 0.05 }]}>
          <View style={[styles.lowerBar, { backgroundColor: p.bgEnabled ? p.bgColor : "transparent", paddingHorizontal: size * 0.5, paddingVertical: size * 0.22, borderRadius: size * 0.2 }]}>
            <Text style={{ color: p.fontColor, fontFamily: family, fontSize: size * 0.8 }}>{text}</Text>
          </View>
        </View>
      );
    case "neon":
      return (
        <View pointerEvents="none" style={[wrapper, { top: height * 0.42 }]}>
          <Text
            style={{
              color: p.fontColor,
              fontFamily: family,
              fontSize: size,
              textShadowColor: p.fontColor,
              textShadowRadius: size * 0.5,
              backgroundColor: p.bgEnabled ? p.bgColor : "transparent",
              textAlign: "center",
            }}
          >
            {text}
          </Text>
        </View>
      );
    default:
      return (
        <View pointerEvents="none" style={[wrapper, { bottom: height * 0.08 }]}>
          <Text
            style={{
              color: p.fontColor,
              fontFamily: family === Fonts.extraBold ? Fonts.semiBold : family,
              fontSize: size * 0.8,
              backgroundColor: p.bgEnabled ? `${p.bgColor}B3` : "transparent",
              paddingHorizontal: size * 0.4,
              paddingVertical: size * 0.12,
              borderRadius: size * 0.15,
              textAlign: "center",
              overflow: "hidden",
            }}
          >
            {text}
          </Text>
        </View>
      );
  }
}

function CompositeFrameBase({ tracks, time, width, height, userMedia, showGuides }: Props) {
  const frame = computeFrame(tracks, time);
  return (
    <View style={[styles.root, { width, height }]} accessibilityLabel="Preview canvas">
      {frame.visuals.length === 0 && frame.texts.length === 0 ? (
        <View style={[StyleSheet.absoluteFill, styles.empty]}>
          <Text style={styles.emptyText}>No clip at playhead</Text>
        </View>
      ) : null}
      {frame.visuals.map((v, i) => (
        <Visual key={v.clip.id} layer={v} width={width} height={height} userMedia={userMedia} isBase={i === 0} />
      ))}
      {frame.texts.map((tl) => (
        <Caption key={tl.clip.id} layer={tl} width={width} height={height} />
      ))}
      {showGuides ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.guide, { left: "5%", right: "5%", top: "5%", bottom: "5%" }]} />
          <View style={[styles.guide, { left: "10%", right: "10%", top: "10%", bottom: "10%", borderStyle: "dashed" }]} />
          <View style={[styles.cross, { left: "50%", top: "47%", height: "6%", width: 1 }]} />
          <View style={[styles.cross, { top: "50%", left: "48%", width: "4%", height: 1 }]} />
        </View>
      ) : null}
    </View>
  );
}

export const CompositeFrame = memo(CompositeFrameBase);

const styles = StyleSheet.create({
  root: { backgroundColor: "#000", overflow: "hidden" },
  empty: { alignItems: "center", justifyContent: "center", backgroundColor: "#07080B" },
  emptyText: { color: "#475569", fontFamily: Fonts.mono, fontSize: 11 },
  missing: { alignItems: "center", justifyContent: "center", backgroundColor: "#111318" },
  missingText: { color: "#64748B", fontFamily: Fonts.mono, fontSize: 10 },
  cinematicWarm: { backgroundColor: "rgba(249,115,22,0.08)" },
  vhs: { backgroundColor: "rgba(255,255,255,0.05)", borderTopWidth: 2, borderBottomWidth: 2, borderColor: "rgba(255,255,255,0.08)" },
  noirIos: { backgroundColor: "rgba(120,120,120,0.55)" },
  glitchBar: { position: "absolute", left: 0, right: 0 },
  title: { fontStyle: "italic", letterSpacing: -1, textShadowColor: "rgba(139,92,246,0.9)", transform: [{ skewX: "-8deg" }] },
  ribbon: { marginTop: 4, borderRadius: 4, transform: [{ skewX: "-12deg" }] },
  lowerBar: { boxShadow: "0 6px 16px rgba(0,0,0,0.4)" },
  guide: { position: "absolute", borderWidth: 1, borderColor: "rgba(6,182,212,0.55)" },
  cross: { position: "absolute", backgroundColor: "rgba(6,182,212,0.7)" },
});
