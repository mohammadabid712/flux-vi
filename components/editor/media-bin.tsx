import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { memo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Artwork, LutPresets, SampleAudio, SampleMedia, TextPresets, TransitionPresets } from "@/constants/media";
import { Fonts } from "@/constants/Typography";
import { makeStyles } from "@/constants/theme";
import type { EditorActions, Notify } from "@/hooks/use-editor-actions";
import { useTheme } from "@/hooks/use-theme";
import { useEditorStore } from "@/store/editor-store";
import type { MediaAsset, Project } from "@/store/types";
import { useAppStore } from "@/store/useAppStore";
import { newId } from "@/utils/id";
import { isHovered } from "@/utils/pressable";
import { toClock } from "@/utils/timecode";
import { findClip } from "@/utils/timeline";

export type BinSection = "media" | "audio" | "text" | "effects" | "transitions";

const SECTIONS: { id: BinSection; label: string; rail: string; icon: string; mci?: boolean }[] = [
  { id: "media", label: "Media", rail: "Media", icon: "film-outline" },
  { id: "audio", label: "Audio", rail: "Audio", icon: "musical-notes-outline" },
  { id: "text", label: "Text", rail: "Text", icon: "text-outline" },
  { id: "effects", label: "Effects & LUTs", rail: "Effects\n& LUTs", icon: "auto-fix", mci: true },
  { id: "transitions", label: "Transitions", rail: "Transitions", icon: "swap-horizontal" },
];

interface Props {
  project: Project;
  actions: EditorActions;
  notify: Notify;
  showRail: boolean;
}

function SectionIcon({ icon, mci, color, size = 18 }: { icon: string; mci?: boolean; color: string; size?: number }) {
  return mci ? <MaterialCommunityIcons name={icon as never} size={size} color={color} /> : <Ionicons name={icon as never} size={size} color={color} />;
}

function MediaTile({ asset, onAdd }: { asset: MediaAsset; onAdd: (a: MediaAsset) => void }) {
  const { theme, colors } = useTheme();
  const s = useStyles(theme);
  const src = asset.artwork ? Artwork[asset.artwork] : asset.url ? { uri: asset.url } : null;
  return (
    <Pressable onPress={() => onAdd(asset)} accessibilityRole="button" accessibilityLabel={`Add ${asset.name} to timeline`} style={s.tileWrap}>
      {({ pressed }) => (
        <View style={[s.tile, pressed && { opacity: 0.8 }]}>
          <View style={s.tileThumb}>
            {src ? <Image source={src} style={s.fill} contentFit="cover" transition={120} /> : null}
            <View style={s.tileDur}>
              <Text style={s.tileDurText}>{asset.type === "image" ? "IMG" : toClock(asset.duration)}</Text>
            </View>
            <View style={s.tileAdd}>
              <Ionicons name="add" size={14} color="#fff" />
            </View>
          </View>
          <Text numberOfLines={1} style={s.tileName}>{asset.name}</Text>
          <Text style={[s.tileMeta, { color: colors.subtle }]}>{asset.resolution}</Text>
        </View>
      )}
    </Pressable>
  );
}

function BinContent({ section, project, actions, notify }: { section: BinSection } & Omit<Props, "showRail">) {
  const { theme, colors } = useTheme();
  const s = useStyles(theme);
  const userMedia = useAppStore((st) => st.userMedia);
  const addUserMedia = useAppStore((st) => st.addUserMedia);
  const selectedClipId = useEditorStore((st) => st.selectedClipId);
  const selected = selectedClipId ? findClip(project.tracks, selectedClipId)?.clip : undefined;
  const [importing, setImporting] = useState(false);

  const importPhoto = async () => {
    setImporting(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        notify("Photo library permission is required to import", "error");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6, base64: process.env.EXPO_OS === "web" });
      if (res.canceled || !res.assets[0]) return;
      const a = res.assets[0];
      // On web, blob: URLs die on reload — keep a data URI when small enough to persist.
      const persistable = a.base64 && a.base64.length < 1_500_000 ? `data:${a.mimeType ?? "image/jpeg"};base64,${a.base64}` : a.uri;
      const asset: MediaAsset = {
        id: `u-${newId()}`,
        name: a.fileName?.replace(/\.[^.]+$/, "") || "Imported Photo",
        type: "image",
        url: persistable,
        thumbnailUrl: persistable,
        duration: 5,
        resolution: `${a.width}x${a.height}`,
        fileSize: a.fileSize ? `${(a.fileSize / (1024 * 1024)).toFixed(1)} MB` : "—",
        category: "user_upload",
      };
      addUserMedia(asset);
      notify(`Imported "${asset.name}"`, "success");
    } catch (e) {
      console.error("Import failed", e);
      notify("Could not import that file", "error");
    } finally {
      setImporting(false);
    }
  };

  switch (section) {
    case "media":
      return (
        <View style={s.sectionBody}>
          <Text style={s.subhead}>Sample Clips</Text>
          <View style={s.grid}>
            {SampleMedia.map((m) => (
              <MediaTile key={m.id} asset={m} onAdd={actions.addAsset} />
            ))}
          </View>
          <Text style={s.subhead}>Your Uploads</Text>
          <Pressable onPress={importPhoto} disabled={importing} accessibilityRole="button" accessibilityLabel="Import photo from device">
            <View style={s.upload}>
              {importing ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />}
              <Text style={s.uploadText}>{importing ? "Importing…" : "Import photo"}</Text>
            </View>
          </Pressable>
          {userMedia.length > 0 ? (
            <View style={s.grid}>
              {userMedia.map((m) => (
                <MediaTile key={m.id} asset={m} onAdd={actions.addAsset} />
              ))}
            </View>
          ) : (
            <Text style={s.hint}>Imported stills land here. Tap any tile to append it to the selected track.</Text>
          )}
        </View>
      );
    case "audio": {
      const groups: { id: MediaAsset["group"]; label: string }[] = [
        { id: "music", label: "Music" },
        { id: "voice", label: "Voice" },
        { id: "sfx", label: "Sound Effects" },
      ];
      return (
        <View style={s.sectionBody}>
          {groups.map((g) => (
            <View key={g.id} style={s.groupBlock}>
              <Text style={s.subhead}>{g.label}</Text>
              {SampleAudio.filter((a) => a.group === g.id).map((a) => (
                <Pressable key={a.id} onPress={() => actions.addAsset(a)} accessibilityRole="button" accessibilityLabel={`Add ${a.name} to timeline`}>
                  {({ pressed }) => (
                    <View style={[s.row, pressed && { opacity: 0.8 }]}>
                      <View style={[s.rowIcon, { backgroundColor: g.id === "music" ? "rgba(20,184,166,0.16)" : "rgba(16,185,129,0.16)" }]}>
                        <MaterialCommunityIcons name={g.id === "sfx" ? "waveform" : g.id === "voice" ? "microphone-outline" : "music-note-eighth"} size={16} color={g.id === "music" ? colors.audio2 : colors.audio1} />
                      </View>
                      <View style={s.flex}>
                        <Text numberOfLines={1} style={s.rowTitle}>{a.name}</Text>
                        <Text style={s.rowMeta}>{toClock(a.duration)} · {a.resolution} · {a.fileSize}</Text>
                      </View>
                      <Ionicons name="add-circle-outline" size={20} color={colors.muted} />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      );
    }
    case "text":
      return (
        <View style={s.sectionBody}>
          {TextPresets.map((t) => (
            <Pressable key={t.id} onPress={() => actions.addText(t)} accessibilityRole="button" accessibilityLabel={`Add ${t.name} at playhead`}>
              {({ pressed }) => (
                <View style={[s.textCard, pressed && { opacity: 0.8 }]}>
                  <View style={s.textPreview}>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: t.props.fontColor,
                        fontFamily: t.props.fontFamily === "JetBrains Mono" ? Fonts.monoBold : Fonts.extraBold,
                        fontSize: t.props.style === "title" ? 18 : 12,
                        fontStyle: t.props.style === "title" ? "italic" : "normal",
                        backgroundColor: t.props.bgEnabled ? t.props.bgColor : "transparent",
                        paddingHorizontal: 6,
                        borderRadius: 3,
                        textShadowColor: t.props.style === "neon" ? t.props.fontColor : "transparent",
                        textShadowRadius: t.props.style === "neon" ? 8 : 0,
                      }}
                    >
                      {t.props.content}
                    </Text>
                  </View>
                  <View style={s.flex}>
                    <Text style={s.rowTitle}>{t.name}</Text>
                    <Text style={s.rowMeta}>{t.description}</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={20} color={colors.muted} />
                </View>
              )}
            </Pressable>
          ))}
        </View>
      );
    case "effects":
      return (
        <View style={s.sectionBody}>
          <Text style={s.hint}>{selected && selected.type !== "audio" && selected.type !== "text" ? `Applying to "${selected.title}"` : "Select a video clip, then tap a LUT."}</Text>
          {LutPresets.map((l) => {
            const active = selected?.filter === l.id;
            return (
              <Pressable key={l.id} onPress={() => actions.applyLut(l.id)} accessibilityRole="button" accessibilityLabel={`Apply ${l.name} LUT`} accessibilityState={{ selected: active }}>
                <View style={[s.row, active && s.rowActive]}>
                  <View style={s.swatch}>
                    <View style={[s.swatchHalf, { backgroundColor: l.swatch[0] }]} />
                    <View style={[s.swatchHalf, { backgroundColor: l.swatch[1] }]} />
                  </View>
                  <Text numberOfLines={1} style={[s.rowTitle, s.flex]}>{l.name}</Text>
                  {active ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      );
    default:
      return (
        <View style={s.sectionBody}>
          <Text style={s.hint}>Transitions play at the head of the selected clip.</Text>
          <View style={s.grid}>
            {TransitionPresets.map((t) => {
              const active = selected?.transition === t.id;
              return (
                <Pressable key={t.id} onPress={() => actions.applyTransition(t.id)} style={s.tileWrap} accessibilityRole="button" accessibilityLabel={`Apply ${t.name}`} accessibilityState={{ selected: active }}>
                  <View style={[s.transCard, active && s.rowActive]}>
                    <Ionicons name={t.icon} size={20} color={active ? colors.primary : colors.text} />
                    <Text numberOfLines={1} style={s.transName}>{t.name}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
  }
}

function MediaBinBase({ project, actions, notify, showRail }: Props) {
  const { theme, colors } = useTheme();
  const s = useStyles(theme);
  const [section, setSection] = useState<BinSection>("media");
  const active = SECTIONS.find((x) => x.id === section) ?? SECTIONS[0];

  return (
    <View style={s.root}>
      {showRail ? (
        <View style={s.rail}>
          {SECTIONS.map((x) => {
            const on = x.id === section;
            return (
              <Pressable key={x.id} onPress={() => setSection(x.id)} accessibilityRole="tab" accessibilityLabel={x.label} accessibilityState={{ selected: on }}>
                <View style={[s.railItem, on && s.railItemOn]}>
                  <SectionIcon icon={x.icon} mci={x.mci} color={on ? colors.text : colors.muted} />
                  <Text style={[s.railText, on && { color: colors.text }]}>{x.rail}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <ScrollView style={s.panel} contentContainerStyle={s.panelContent} nestedScrollEnabled>
        <View style={s.accHeader} accessibilityRole="header">
          <SectionIcon icon={active.icon} mci={active.mci} color={colors.text} size={17} />
          <Text style={s.accTitle}>{active.label}</Text>
          <Ionicons name="chevron-up" size={16} color={colors.muted} />
        </View>
        <BinContent section={section} project={project} actions={actions} notify={notify} />
        {SECTIONS.filter((x) => x.id !== section).map((x) => (
          <Pressable key={x.id} onPress={() => setSection(x.id)} accessibilityRole="button" accessibilityLabel={`Open ${x.label}`}>
            {(state) => (
              <View style={[s.accHeader, s.accCollapsed, isHovered(state) && { backgroundColor: colors.hover }]}>
                <SectionIcon icon={x.icon} mci={x.mci} color={colors.muted} size={17} />
                <Text style={[s.accTitle, { color: colors.text }]}>{x.label}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.muted} />
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export const MediaBin = memo(MediaBinBase);

const useStyles = makeStyles((c) => ({
  root: { flex: 1, flexDirection: "row", backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  rail: { width: 78, borderRightWidth: 1, borderRightColor: c.border, paddingVertical: 8, paddingHorizontal: 6, gap: 4 },
  railItem: { alignItems: "center", gap: 4, paddingVertical: 10, borderRadius: 8 },
  railItemOn: { backgroundColor: c.primarySoft, borderWidth: 1, borderColor: "rgba(99,102,241,0.5)" },
  railText: { fontFamily: Fonts.medium, fontSize: 10.5, color: c.muted, textAlign: "center" },
  panel: { flex: 1 },
  panelContent: { paddingBottom: 12 },
  accHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, height: 46 },
  accCollapsed: { borderTopWidth: 1, borderTopColor: c.border },
  accTitle: { flex: 1, fontFamily: Fonts.semiBold, fontSize: 14, color: c.text },
  sectionBody: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  subhead: { fontFamily: Fonts.medium, fontSize: 12, color: c.muted },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tileWrap: { width: "47.5%", flexGrow: 1, maxWidth: 160 },
  tile: { gap: 3 },
  tileThumb: { width: "100%", aspectRatio: 1.3, borderRadius: 8, overflow: "hidden", backgroundColor: c.panel, borderWidth: 1, borderColor: c.border },
  fill: { width: "100%", height: "100%" },
  tileDur: { position: "absolute", left: 4, bottom: 4, backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 4, paddingHorizontal: 4 },
  tileDurText: { fontFamily: Fonts.monoMedium, fontSize: 9, color: "#fff" },
  tileAdd: { position: "absolute", right: 4, top: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(99,102,241,0.9)", alignItems: "center", justifyContent: "center" },
  tileName: { fontFamily: Fonts.medium, fontSize: 12, color: c.text },
  tileMeta: { fontFamily: Fonts.mono, fontSize: 9.5 },
  upload: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 40, borderRadius: 8, borderWidth: 1, borderStyle: "dashed", borderColor: c.primary, backgroundColor: c.primarySoft },
  uploadText: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: c.text },
  hint: { fontFamily: Fonts.regular, fontSize: 11.5, color: c.subtle, lineHeight: 16 },
  groupBlock: { gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, minHeight: 44, borderRadius: 8, backgroundColor: c.panel, borderWidth: 1, borderColor: "transparent" },
  rowActive: { borderColor: c.primary, backgroundColor: c.primarySoft },
  rowIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontFamily: Fonts.medium, fontSize: 12.5, color: c.text },
  rowMeta: { fontFamily: Fonts.mono, fontSize: 10, color: c.muted, marginTop: 1 },
  flex: { flex: 1 },
  textCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: 8, backgroundColor: c.panel },
  textPreview: { width: 96, height: 44, borderRadius: 6, backgroundColor: "#0A0B0E", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  swatch: { width: 30, height: 30, borderRadius: 8, overflow: "hidden", flexDirection: "row" },
  swatchHalf: { flex: 1 },
  transCard: { height: 64, borderRadius: 8, backgroundColor: c.panel, alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: c.border, paddingHorizontal: 4 },
  transName: { fontFamily: Fonts.medium, fontSize: 11, color: c.text },
}));
