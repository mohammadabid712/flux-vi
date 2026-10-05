import { Ionicons } from "@expo/vector-icons";
import { memo, type ReactNode, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { LutPresets, lutById } from "@/constants/media";
import { Fonts } from "@/constants/Typography";
import { makeStyles } from "@/constants/theme";
import type { EditorActions } from "@/hooks/use-editor-actions";
import { useTheme } from "@/hooks/use-theme";
import { useEditorStore } from "@/store/editor-store";
import type { Clip, Project, TextAnimation, TextProperties, Track } from "@/store/types";
import { dbToVolume, formatDb, toTimecode, volumeToDb } from "@/utils/timecode";
import { findClip } from "@/utils/timeline";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import { MessageState } from "@/components/ui/state-views";

interface Props {
  project: Project;
  actions: EditorActions;
}

const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 4];
const TEXT_COLORS = ["#FFFFFF", "#F8FAFC", "#22D3EE", "#F59E0B", "#EC4899", "#10B981", "#111827"];
const BG_COLORS = ["#000000", "#6366F1", "#8B5CF6", "#EF4444", "#F59E0B", "#0EA5E9"];
const FONTS = ["Plus Jakarta Sans", "JetBrains Mono", "System"];
const SIZES = [16, 20, 24, 28, 32, 36, 48, 64, 80, 96];
const ANIMS: TextAnimation[] = ["none", "fade", "pop", "slide", "typewriter"];

function Section({ icon, title, children, defaultOpen = true }: { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; children: ReactNode; defaultOpen?: boolean }) {
  const { theme, colors } = useTheme();
  const s = useStyles(theme);
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={s.section}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityLabel={`${title} section`} accessibilityState={{ expanded: open }}>
        <View style={s.sectionHead}>
          <Ionicons name={icon} size={15} color={colors.text} />
          <Text style={s.sectionTitle}>{title}</Text>
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={colors.muted} />
        </View>
      </Pressable>
      {open ? <View style={s.sectionBody}>{children}</View> : null}
    </View>
  );
}

function SliderRow({ label, value, min, max, step, display, onLive, onDone, color }: { label: string; value: number; min: number; max: number; step?: number; display: string; onLive: (v: number) => void; onDone: () => void; color?: string }) {
  const { theme, colors } = useTheme();
  const s = useStyles(theme);
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Slider value={value} min={min} max={max} step={step} onChange={onLive} onComplete={onDone} accessibilityLabel={label} color={color ?? colors.video1} trackColor={colors.border} />
      <Text style={s.rowValue}>{display}</Text>
    </View>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const { theme } = useTheme();
  const s = useStyles(theme);
  return (
    <View style={[s.row, s.toggleRow]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Toggle value={value} onChange={onChange} accessibilityLabel={label} size="sm" />
    </View>
  );
}

function Pills<T extends string | number>({ options, value, onChange, format, label }: { options: T[]; value: T; onChange: (v: T) => void; format: (v: T) => string; label: string }) {
  const { theme } = useTheme();
  const s = useStyles(theme);
  return (
    <View style={s.pills} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={String(o)} onPress={() => onChange(o)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={format(o)} hitSlop={3}>
            <View style={[s.pill, on && s.pillOn]}>
              <Text style={[s.pillText, on && s.pillTextOn]}>{format(o)}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function Select<T extends string | number>({ value, options, onChange, format, label }: { value: T; options: T[]; onChange: (v: T) => void; format: (v: T) => string; label: string }) {
  const { theme, colors } = useTheme();
  const s = useStyles(theme);
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityLabel={`${label}: ${format(value)}`} accessibilityState={{ expanded: open }}>
        <View style={s.select}>
          <Text numberOfLines={1} style={s.selectText}>{format(value)}</Text>
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={13} color={colors.muted} />
        </View>
      </Pressable>
      {open ? (
        <View style={s.selectList}>
          {options.map((o) => (
            <Pressable
              key={String(o)}
              onPress={() => {
                onChange(o);
                setOpen(false);
              }}
              accessibilityRole="menuitem"
              accessibilityLabel={format(o)}
            >
              <View style={[s.selectItem, o === value && { backgroundColor: colors.primarySoft }]}>
                <Text style={s.selectText}>{format(o)}</Text>
                {o === value ? <Ionicons name="checkmark" size={13} color={colors.primary} /> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Swatches({ colors: list, value, onChange, label }: { colors: string[]; value: string; onChange: (c: string) => void; label: string }) {
  const { theme } = useTheme();
  const s = useStyles(theme);
  return (
    <View style={s.swatches} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {list.map((c) => (
        <Pressable key={c} onPress={() => onChange(c)} accessibilityRole="radio" accessibilityLabel={`${label} ${c}`} accessibilityState={{ checked: c.toLowerCase() === value.toLowerCase() }} hitSlop={4}>
          <View style={[s.swatch, { backgroundColor: c }, c.toLowerCase() === value.toLowerCase() && s.swatchOn]} />
        </Pressable>
      ))}
    </View>
  );
}

function TextEditor({ clip, actions }: { clip: Clip; actions: EditorActions }) {
  const { theme, colors } = useTheme();
  const s = useStyles(theme);
  const p = clip.textProperties as TextProperties;
  const set = (label: string, patch: Partial<TextProperties>) => actions.patchSelected(label, { textProperties: { ...p, ...patch } });
  return (
    <Section icon="text-outline" title="Text Editor">
      <TextInput
        value={p.content}
        onChangeText={(v) => {
          actions.patchSelected("Edit Text", { textProperties: { ...p, content: v }, title: v }, "live");
        }}
        onBlur={() => actions.endLive("Edit Text")}
        style={s.input}
        placeholder="Caption text"
        placeholderTextColor={colors.subtle}
        accessibilityLabel="Caption text"
        maxLength={80}
      />
      <View style={s.row}>
        <Text style={s.rowLabel}>Font Family</Text>
        <View style={s.flex}>
          <Select label="Font family" value={p.fontFamily} options={FONTS} format={(v) => v} onChange={(v) => set("Change Font", { fontFamily: v })} />
        </View>
      </View>
      <View style={s.row}>
        <Text style={s.rowLabel}>Font Size</Text>
        <View style={s.flex}>
          <Select label="Font size" value={p.fontSize} options={SIZES} format={(v) => String(v)} onChange={(v) => set("Change Font Size", { fontSize: v })} />
        </View>
      </View>
      <Text style={s.rowLabel}>Text Color</Text>
      <Swatches label="Text color" colors={TEXT_COLORS} value={p.fontColor} onChange={(c) => set("Change Text Color", { fontColor: c })} />
      <ToggleRow label="Background Box" value={p.bgEnabled} onChange={(v) => set("Toggle Background", { bgEnabled: v })} />
      {p.bgEnabled ? <Swatches label="Background color" colors={BG_COLORS} value={p.bgColor} onChange={(c) => set("Change Background", { bgColor: c })} /> : null}
      <Text style={s.rowLabel}>Animation</Text>
      <Pills label="Text animation" options={ANIMS} value={p.animation} format={(v) => v[0].toUpperCase() + v.slice(1)} onChange={(v) => set("Change Animation", { animation: v })} />
    </Section>
  );
}

function TrackSection({ track, actions }: { track: Track; actions: EditorActions }) {
  const db = volumeToDb(track.volume);
  return (
    <Section icon="layers-outline" title={`Track ${track.label} · ${track.name}`} defaultOpen={false}>
      {track.type === "audio" ? (
        <SliderRow
          label="Track Gain"
          value={db}
          min={-60}
          max={6}
          step={0.5}
          display={formatDb(track.volume)}
          onLive={(v) => actions.updateTrack(track.id, "Change Track Volume", { volume: dbToVolume(v) }, "live")}
          onDone={() => actions.endLive("Change Track Volume")}
        />
      ) : null}
      <ToggleRow label={track.type === "audio" ? "Mute" : "Hidden"} value={track.isMuted} onChange={(v) => actions.updateTrack(track.id, "Mute Track", { isMuted: v })} />
      <ToggleRow label="Solo" value={track.isSolo} onChange={(v) => actions.updateTrack(track.id, "Solo Track", { isSolo: v })} />
      <ToggleRow label="Lock" value={track.isLocked} onChange={(v) => actions.updateTrack(track.id, "Lock Track", { isLocked: v })} />
    </Section>
  );
}

function InspectorBase({ project, actions }: Props) {
  const { theme, colors } = useTheme();
  const s = useStyles(theme);
  const selectedClipId = useEditorStore((st) => st.selectedClipId);
  const selectedTrackId = useEditorStore((st) => st.selectedTrackId);
  const found = selectedClipId ? findClip(project.tracks, selectedClipId) : null;
  const track = found?.track ?? project.tracks.find((t) => t.id === selectedTrackId);

  const header = (
    <View style={s.head}>
      <Ionicons name="options-outline" size={17} color={colors.text} />
      <Text style={s.headTitle}>Clip Inspector</Text>
    </View>
  );

  if (!found) {
    return (
      <View style={s.root}>
        {header}
        <ScrollView contentContainerStyle={s.scroll}>
          <MessageState fill={false} icon="hand-left-outline" title="No clip selected" message="Select a clip on the timeline to edit transform, audio, speed, color and text." />
          {track ? <TrackSection track={track} actions={actions} /> : null}
        </ScrollView>
      </View>
    );
  }

  const { clip } = found;
  const live = (label: string, patch: Partial<Clip>) => actions.patchSelected(label, patch, "live");
  const done = (label: string) => () => actions.endLive(label);
  const t = clip.transform;
  const visual = clip.type === "video" || clip.type === "image";
  const hasAudio = clip.type === "audio" || clip.type === "video";
  const locked = found.track.isLocked;

  return (
    <View style={s.root}>
      {header}
      <ScrollView contentContainerStyle={s.scroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        <View style={s.clipCard}>
          <View style={[s.clipDot, { backgroundColor: found.track.color }]} />
          <View style={s.flex}>
            <Text numberOfLines={1} style={s.clipTitle}>{clip.title}</Text>
            <Text style={s.clipMeta}>
              {found.track.label} · In {toTimecode(clip.inPoint, project.frameRate)} · Dur {clip.duration.toFixed(2)}s
            </Text>
          </View>
          {locked ? <Ionicons name="lock-closed" size={14} color={colors.amber} /> : null}
        </View>
        <View pointerEvents={locked ? "none" : "auto"} style={locked && s.locked}>
          <Section icon="scan-outline" title="Transform">
            <SliderRow label="Scale" value={t.scale} min={0.1} max={2} step={0.01} display={`${Math.round(t.scale * 100)}%`} onLive={(v) => live("Change Scale", { transform: { ...t, scale: v } })} onDone={done("Change Scale")} />
            <SliderRow label="Position X" value={t.posX} min={-0.5} max={0.5} step={0.005} display={`${Math.round(t.posX * project.resolution.width)}`} onLive={(v) => live("Change Position", { transform: { ...t, posX: v } })} onDone={done("Change Position")} />
            <SliderRow label="Position Y" value={t.posY} min={-0.5} max={0.5} step={0.005} display={`${Math.round(t.posY * project.resolution.height)}`} onLive={(v) => live("Change Position", { transform: { ...t, posY: v } })} onDone={done("Change Position")} />
            <SliderRow label="Rotation" value={t.rotation} min={-180} max={180} step={1} display={`${Math.round(t.rotation)}°`} onLive={(v) => live("Change Rotation", { transform: { ...t, rotation: v } })} onDone={done("Change Rotation")} />
            <SliderRow label="Opacity" value={t.opacity} min={0} max={1} step={0.01} display={`${Math.round(t.opacity * 100)}%`} onLive={(v) => live("Change Opacity", { transform: { ...t, opacity: v } })} onDone={done("Change Opacity")} />
          </Section>
          {hasAudio ? (
            <Section icon="volume-medium-outline" title="Audio">
              <SliderRow label="Volume" value={volumeToDb(clip.volume)} min={-60} max={3.5} step={0.5} display={formatDb(clip.volume)} color={colors.audio1} onLive={(v) => live("Change Volume", { volume: dbToVolume(v) })} onDone={done("Change Volume")} />
              <SliderRow label="Fade In" value={clip.fadeIn} min={0} max={Math.min(5, clip.duration / 2)} step={0.1} display={`${clip.fadeIn.toFixed(1)}s`} color={colors.audio1} onLive={(v) => live("Change Fade In", { fadeIn: v })} onDone={done("Change Fade In")} />
              <SliderRow label="Fade Out" value={clip.fadeOut} min={0} max={Math.min(5, clip.duration / 2)} step={0.1} display={`${clip.fadeOut.toFixed(1)}s`} color={colors.audio1} onLive={(v) => live("Change Fade Out", { fadeOut: v })} onDone={done("Change Fade Out")} />
              <ToggleRow label="Mute" value={clip.isMuted} onChange={(v) => actions.patchSelected("Mute Clip", { isMuted: v })} />
              <ToggleRow label="Ducking" value={clip.ducking} onChange={(v) => actions.patchSelected("Toggle Ducking", { ducking: v })} />
            </Section>
          ) : null}
          {clip.type !== "text" ? (
            <Section icon="speedometer-outline" title="Speed">
              <Pills label="Clip speed" options={SPEEDS} value={clip.speed} format={(v) => `${v}x`} onChange={actions.setSpeed} />
              <ToggleRow label="Reverse" value={clip.reverse} onChange={(v) => actions.patchSelected("Reverse Clip", { reverse: v })} />
              <Text style={s.hint}>Source {(clip.outPoint - clip.inPoint).toFixed(2)}s → timeline {clip.duration.toFixed(2)}s</Text>
            </Section>
          ) : null}
          {visual ? (
            <Section icon="color-palette-outline" title="Color Grade">
              <Select label="LUT preset" value={clip.filter} options={LutPresets.map((l) => l.id)} format={(v) => lutById(v).name} onChange={(v) => actions.applyLut(v)} />
              <SliderRow label="Brightness" value={clip.adjust.brightness} min={-100} max={100} step={1} display={`${Math.round(clip.adjust.brightness)}%`} onLive={(v) => live("Adjust Brightness", { adjust: { ...clip.adjust, brightness: v } })} onDone={done("Adjust Brightness")} />
              <SliderRow label="Contrast" value={clip.adjust.contrast} min={-100} max={100} step={1} display={`${Math.round(clip.adjust.contrast)}%`} onLive={(v) => live("Adjust Contrast", { adjust: { ...clip.adjust, contrast: v } })} onDone={done("Adjust Contrast")} />
              <SliderRow label="Saturation" value={clip.adjust.saturation} min={-100} max={100} step={1} display={`${Math.round(clip.adjust.saturation)}%`} onLive={(v) => live("Adjust Saturation", { adjust: { ...clip.adjust, saturation: v } })} onDone={done("Adjust Saturation")} />
            </Section>
          ) : null}
          {clip.type === "text" && clip.textProperties ? <TextEditor clip={clip} actions={actions} /> : null}
        </View>
        <TrackSection track={found.track} actions={actions} />
      </ScrollView>
    </View>
  );
}

export const Inspector = memo(InspectorBase);

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, height: 44, borderBottomWidth: 1, borderBottomColor: c.border },
  headTitle: { flex: 1, fontFamily: Fonts.semiBold, fontSize: 14, color: c.text },
  scroll: { paddingBottom: 16 },
  clipCard: { flexDirection: "row", alignItems: "center", gap: 10, margin: 10, padding: 10, borderRadius: 8, backgroundColor: c.panel },
  clipDot: { width: 8, height: 28, borderRadius: 3 },
  clipTitle: { fontFamily: Fonts.semiBold, fontSize: 13, color: c.text },
  clipMeta: { fontFamily: Fonts.mono, fontSize: 10, color: c.muted, marginTop: 2 },
  locked: { opacity: 0.45 },
  section: { borderTopWidth: 1, borderTopColor: c.border },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, height: 40 },
  sectionTitle: { flex: 1, fontFamily: Fonts.medium, fontSize: 13, color: c.text },
  sectionBody: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 28 },
  toggleRow: { justifyContent: "space-between" },
  rowLabel: { width: 78, fontFamily: Fonts.regular, fontSize: 11.5, color: c.muted },
  rowValue: { width: 46, textAlign: "right", fontFamily: Fonts.mono, fontSize: 11, color: c.text },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: { minWidth: 48, height: 30, paddingHorizontal: 8, borderRadius: 7, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, alignItems: "center", justifyContent: "center" },
  pillOn: { backgroundColor: c.primary, borderColor: c.primary },
  pillText: { fontFamily: Fonts.medium, fontSize: 11.5, color: c.text },
  pillTextOn: { color: "#fff" },
  select: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 32, paddingHorizontal: 10, borderRadius: 7, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel },
  selectText: { flex: 1, fontFamily: Fonts.medium, fontSize: 12, color: c.text },
  selectList: { marginTop: 4, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, overflow: "hidden" },
  selectItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, height: 34 },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: c.border },
  swatchOn: { borderWidth: 2, borderColor: c.cyan, transform: [{ scale: 1.12 }] },
  input: { height: 36, borderRadius: 7, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, paddingHorizontal: 10, color: c.text, fontFamily: Fonts.medium, fontSize: 12.5 },
  hint: { fontFamily: Fonts.mono, fontSize: 10, color: c.subtle },
  flex: { flex: 1 },
}));
