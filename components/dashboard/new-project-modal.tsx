import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Artwork, SampleAudio, SampleMedia } from "@/constants/media";
import { AspectOptions, type QuickPreset } from "@/constants/presets";
import { Fonts } from "@/constants/Typography";
import { makeStyles } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { AspectRatio, FrameRate } from "@/store/types";
import type { NewProjectInput } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { ModalPanel } from "@/components/ui/modal-panel";
import { Segmented } from "@/components/ui/segmented";
import { toClock } from "@/utils/timecode";

interface Props {
  visible: boolean;
  preset: QuickPreset | null;
  onClose: () => void;
  onCreate: (input: NewProjectInput) => void;
}

const HEIGHTS = [
  { value: 2160, label: "4K" },
  { value: 1080, label: "1080p" },
  { value: 720, label: "720p" },
];

const FPS = [
  { value: 24, label: "24fps" },
  { value: 30, label: "30fps" },
  { value: 60, label: "60fps" },
];

export function NewProjectModal({ visible, preset, onClose, onCreate }: Props) {
  const { theme, colors } = useTheme();
  const s = useStyles(theme);
  // The parent remounts this component (via key) each time it opens, so the
  // preset only seeds the initial state.
  const [title, setTitle] = useState(preset?.defaultTitle ?? "");
  const [aspect, setAspect] = useState<AspectRatio>(preset?.aspectRatio ?? "16:9");
  const [height, setHeight] = useState(preset?.height ?? 1080);
  const [fps, setFps] = useState<FrameRate>(preset?.frameRate ?? 30);
  const [starters, setStarters] = useState<string[]>(preset?.starterMediaIds ?? []);

  const toggle = (id: string) =>
    setStarters((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const create = () =>
    onCreate({ title: title.trim() || "Untitled Project", aspectRatio: aspect, frameRate: fps, height, starterMediaIds: starters });

  return (
    <ModalPanel visible={visible} onClose={onClose} maxWidth={560} accessibilityLabel="New project">
      <View style={s.header}>
        <View>
          <Text style={s.h1}>New Project</Text>
          <Text style={s.h2}>{preset ? `${preset.name} preset` : "Choose a canvas and starter media"}</Text>
        </View>
        <Button icon="close" variant="ghost" size="sm" onPress={onClose} accessibilityLabel="Close" />
      </View>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={s.label}>Project title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Untitled Project"
          placeholderTextColor={colors.subtle}
          style={s.input}
          accessibilityLabel="Project title"
          returnKeyType="done"
          maxLength={60}
        />
        <Text style={s.label}>Aspect ratio</Text>
        <View style={s.aspectRow}>
          {AspectOptions.map((o) => {
            const sel = o.value === aspect;
            const [w, h] = o.value.split(":").map(Number);
            const box = 26;
            const bw = w >= h ? box : (box * w) / h;
            const bh = h >= w ? box : (box * h) / w;
            return (
              <Pressable
                key={o.value}
                onPress={() => setAspect(o.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: sel }}
                accessibilityLabel={`${o.label} ${o.hint}`}
                style={s.aspectItem}
              >
                <View style={[s.aspectCard, sel && s.aspectSel]}>
                  <View style={s.aspectBoxWrap}>
                    <View style={[s.aspectBox, { width: bw, height: bh, borderColor: sel ? colors.primary : colors.muted }]} />
                  </View>
                  <Text style={s.aspectLabel}>{o.label}</Text>
                  <Text style={s.aspectHint}>{o.hint}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <Text style={s.label}>Resolution</Text>
        <Segmented options={HEIGHTS} value={height} onChange={setHeight} accessibilityLabel="Resolution" size="sm" />
        <Text style={s.label}>Frame rate</Text>
        <Segmented options={FPS} value={fps} onChange={(v) => setFps(v as FrameRate)} accessibilityLabel="Frame rate" size="sm" />
        <Text style={s.label}>Starter media ({starters.length} selected)</Text>
        <View style={s.mediaGrid}>
          {[...SampleMedia.slice(0, 4), ...SampleAudio.slice(0, 2)].map((m) => {
            const sel = starters.includes(m.id);
            return (
              <Pressable
                key={m.id}
                onPress={() => toggle(m.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: sel }}
                accessibilityLabel={m.name}
                style={s.mediaItem}
              >
                <View style={[s.mediaCard, sel && s.aspectSel]}>
                  {m.artwork ? (
                    <Image source={Artwork[m.artwork]} style={s.mediaThumb} contentFit="cover" />
                  ) : (
                    <View style={[s.mediaThumb, s.audioThumb]}>
                      <Ionicons name="musical-notes" size={18} color={colors.audio2} />
                    </View>
                  )}
                  <View style={s.mediaText}>
                    <Text numberOfLines={1} style={s.mediaName}>{m.name}</Text>
                    <Text style={s.aspectHint}>{toClock(m.duration)}</Text>
                  </View>
                  <Ionicons name={sel ? "checkmark-circle" : "ellipse-outline"} size={18} color={sel ? colors.primary : colors.subtle} />
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <View style={s.footer}>
        <Button label="Cancel" variant="outline" onPress={onClose} flex />
        <Button label="Create Project" icon="sparkles" onPress={create} flex />
      </View>
    </ModalPanel>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 18, paddingBottom: 6 },
  h1: { fontFamily: Fonts.bold, fontSize: 19, color: c.text },
  h2: { fontFamily: Fonts.regular, fontSize: 13, color: c.muted, marginTop: 2 },
  body: { padding: 18, paddingTop: 6, gap: 8 },
  label: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: c.muted, marginTop: 8, textTransform: "uppercase", letterSpacing: 0.6 },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.panel,
    paddingHorizontal: 12,
    color: c.text,
    fontFamily: Fonts.medium,
    fontSize: 14,
  },
  aspectRow: { flexDirection: "row", gap: 8 },
  aspectItem: { flex: 1 },
  aspectCard: { borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, alignItems: "center", paddingVertical: 10, gap: 2 },
  aspectSel: { borderColor: c.primary, backgroundColor: c.primarySoft },
  aspectBoxWrap: { height: 30, justifyContent: "center", marginBottom: 4 },
  aspectBox: { borderWidth: 2, borderRadius: 3 },
  aspectLabel: { fontFamily: Fonts.semiBold, fontSize: 13, color: c.text },
  aspectHint: { fontFamily: Fonts.regular, fontSize: 11, color: c.muted },
  mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mediaItem: { width: "48.5%", flexGrow: 1 },
  mediaCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 6, paddingRight: 10, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel },
  mediaThumb: { width: 48, height: 36, borderRadius: 6 },
  audioThumb: { backgroundColor: c.hover, alignItems: "center", justifyContent: "center" },
  mediaText: { flex: 1 },
  mediaName: { fontFamily: Fonts.medium, fontSize: 12.5, color: c.text },
  footer: { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: c.border },
}));
