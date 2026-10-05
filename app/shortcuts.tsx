import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { LoadingState } from "@/components/ui/state-views";
import { Fonts } from "@/constants/Typography";
import { makeStyles } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { EditorSettings, WaveformDetail } from "@/store/types";
import { useAppStore } from "@/store/useAppStore";

interface Shortcut {
  keys: string;
  title: string;
  desc: string;
}

interface Group {
  title: string;
  sub: string;
  icon: string;
  mci?: boolean;
  tint: string;
  items: Shortcut[];
}

const GROUPS: Group[] = [
  {
    title: "Playback",
    sub: "Controls for preview and navigation",
    icon: "play",
    tint: "#3B82F6",
    items: [
      { keys: "Space", title: "Play / Pause", desc: "Start or stop playback" },
      { keys: "J / K / L", title: "Playback Speed", desc: "Rewind / Pause / Fast Forward" },
      { keys: "← / →", title: "Frame Navigation", desc: "Previous / Next frame (Shift = 1s)" },
    ],
  },
  {
    title: "Editing",
    sub: "Core editing and clip tools",
    icon: "pencil",
    tint: "#8B5CF6",
    items: [
      { keys: "S", title: "Split", desc: "Split clip at playhead" },
      { keys: "V", title: "Selection", desc: "Select tool" },
      { keys: "B", title: "Blade", desc: "Razor blade tool" },
      { keys: "Del", title: "Delete", desc: "Remove selected clip" },
    ],
  },
  {
    title: "Timeline",
    sub: "Zoom and navigation controls",
    icon: "layers",
    tint: "#06B6D4",
    items: [
      { keys: "+ / -", title: "Zoom", desc: "Zoom in / out timeline" },
      { keys: "Home / End", title: "Go to Start / End", desc: "Jump to project start/end" },
      { keys: "I / O", title: "In / Out", desc: "Set in and out points" },
    ],
  },
  {
    title: "History",
    sub: "Undo and redo actions",
    icon: "refresh",
    tint: "#A855F7",
    items: [
      { keys: "Cmd + Z", title: "Undo", desc: "Revert last action" },
      { keys: "Cmd + Shift + Z", title: "Redo", desc: "Reapply next action" },
    ],
  },
];

const SNAP_OPTIONS = [2, 4, 8, 12, 16, 24];

function GroupCard({ group }: { group: Group }) {
  const { theme } = useTheme();
  const s = useStyles(theme);
  return (
    <View style={s.card}>
      <View style={s.groupHead}>
        <View style={[s.groupIcon, { backgroundColor: `${group.tint}33`, borderColor: `${group.tint}66` }]}>
          <Ionicons name={group.icon as never} size={20} color={group.tint} />
        </View>
        <View style={s.flexShrink}>
          <Text style={s.groupTitle}>{group.title}</Text>
          <Text style={s.groupSub}>{group.sub}</Text>
        </View>
      </View>
      {group.items.map((it) => (
        <View key={it.keys} style={s.item} accessible accessibilityLabel={`${it.keys}: ${it.title}. ${it.desc}`}>
          <View style={s.key}>
            <Text style={s.keyText}>{it.keys}</Text>
          </View>
          <View style={s.flexShrink}>
            <Text style={s.itemTitle}>{it.title}</Text>
            <Text style={s.itemDesc}>{it.desc}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function SettingRow({ icon, tint, title, desc, children }: { icon: string; tint: string; title: string; desc: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  const s = useStyles(theme);
  return (
    <View style={s.settingRow}>
      <View style={s.settingInfo}>
        <View style={[s.settingIcon, { borderColor: `${tint}55`, backgroundColor: `${tint}1F` }]}>
          <MaterialCommunityIcons name={icon as never} size={20} color={tint} />
        </View>
        <View style={s.flexShrink}>
          <Text style={s.itemTitle}>{title}</Text>
          <Text style={s.itemDesc}>{desc}</Text>
        </View>
      </View>
      <View style={s.settingControl}>{children}</View>
    </View>
  );
}

export default function ShortcutsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { theme, colors } = useTheme();
  const s = useStyles(theme);
  const hydrated = useAppStore((st) => st.hasHydrated);
  const settings = useAppStore((st) => st.settings);
  const updateSettings = useAppStore((st) => st.updateSettings);
  const [draft, setDraft] = useState<EditorSettings>(settings);
  const [snapOpen, setSnapOpen] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const save = () => {
    updateSettings(draft);
    close();
  };

  if (!hydrated) return <LoadingState label="Loading preferences…" />;

  const twoCol = width >= 720;

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={10}>
          <Text style={s.cancel}>Cancel</Text>
        </Pressable>
        <Text numberOfLines={2} style={[s.title, !twoCol && { fontSize: 16 }]}>Keyboard Shortcuts & Pro Settings</Text>
        <Button label={twoCol ? "Save Settings" : "Save"} onPress={save} disabled={!dirty} accessibilityLabel="Save Settings" />
      </View>
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}>
        <View style={s.inner}>
          <View style={[s.grid, !twoCol && s.stack]}>
            {GROUPS.slice(0, 2).map((g) => (
              <View key={g.title} style={s.col}>
                <GroupCard group={g} />
              </View>
            ))}
          </View>
          <View style={[s.grid, !twoCol && s.stack]}>
            {GROUPS.slice(2).map((g) => (
              <View key={g.title} style={s.col}>
                <GroupCard group={g} />
              </View>
            ))}
          </View>

          <View style={s.card}>
            <View style={[s.groupHead, s.proHead]}>
              <View style={[s.groupIcon, { backgroundColor: "rgba(99,102,241,0.25)", borderColor: "rgba(99,102,241,0.5)" }]}>
                <Ionicons name="settings" size={20} color="#A5B4FC" />
              </View>
              <View style={s.flexShrink}>
                <Text style={s.groupTitle}>Pro Settings</Text>
                <Text style={s.groupSub}>Customize your editing experience</Text>
              </View>
            </View>
            <SettingRow icon="magnet" tint="#06B6D4" title="Snap Tolerance" desc="How close clips need to be to snap together">
              <View>
                <Pressable onPress={() => setSnapOpen((o) => !o)} accessibilityRole="button" accessibilityLabel={`Snap tolerance ${draft.snapTolerance} pixels`} accessibilityState={{ expanded: snapOpen }}>
                  <View style={s.snapBtn}>
                    <Text style={s.snapText}>{draft.snapTolerance} px</Text>
                    <Ionicons name={snapOpen ? "chevron-down" : "chevron-forward"} size={16} color={colors.muted} />
                  </View>
                </Pressable>
              </View>
            </SettingRow>
            {snapOpen ? (
              <Segmented
                options={SNAP_OPTIONS.map((v) => ({ value: v, label: `${v} px` }))}
                value={draft.snapTolerance}
                onChange={(v) => {
                  setDraft((d) => ({ ...d, snapTolerance: v }));
                  setSnapOpen(false);
                }}
                accessibilityLabel="Snap tolerance options"
                size="sm"
                wrap
              />
            ) : null}
            <View style={s.divider} />
            <SettingRow icon="link-variant" tint="#8B5CF6" title="Ripple Edit Default" desc="Default behavior when adding or removing clips">
              <Segmented
                options={[
                  { value: "on", label: "On" },
                  { value: "off", label: "Off" },
                ]}
                value={draft.rippleDefault ? "on" : "off"}
                onChange={(v) => setDraft((d) => ({ ...d, rippleDefault: v === "on" }))}
                variant="joined"
                accessibilityLabel="Ripple edit default"
                style={s.segSmall}
              />
            </SettingRow>
            <View style={s.divider} />
            <SettingRow icon="waveform" tint="#14B8A6" title="Audio Waveform Detail" desc="Level of detail in audio waveforms">
              <Segmented<WaveformDetail>
                options={[
                  { value: "simple", label: "Simple" },
                  { value: "medium", label: "Medium" },
                  { value: "detailed", label: "Detailed" },
                ]}
                value={draft.waveformDetail}
                onChange={(v) => setDraft((d) => ({ ...d, waveformDetail: v }))}
                variant="joined"
                accessibilityLabel="Audio waveform detail"
                style={s.segWide}
              />
            </SettingRow>
          </View>
          {dirty ? <Text style={s.unsaved}>Unsaved changes — tap Save Settings to apply.</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, justifyContent: "space-between" },
  cancel: { fontFamily: Fonts.medium, fontSize: 16, color: "#818CF8", paddingVertical: 8 },
  title: { flex: 1, textAlign: "center", fontFamily: Fonts.bold, fontSize: 20, color: c.text },
  content: { paddingHorizontal: 14, alignItems: "center" },
  inner: { width: "100%", maxWidth: 1000, gap: 14 },
  grid: { flexDirection: "row", gap: 14 },
  stack: { flexDirection: "column" },
  col: { flex: 1 },
  card: { flex: 1, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 16, gap: 12 },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  proHead: { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.border },
  groupIcon: { width: 42, height: 42, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  groupTitle: { fontFamily: Fonts.semiBold, fontSize: 18, color: c.text },
  groupSub: { fontFamily: Fonts.regular, fontSize: 13, color: "#8B9CD8", marginTop: 1 },
  flexShrink: { flexShrink: 1 },
  item: { flexDirection: "row", alignItems: "center", gap: 14 },
  key: { minWidth: 78, height: 38, paddingHorizontal: 10, borderRadius: 8, backgroundColor: c.panel, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", boxShadow: "0 2px 0 rgba(0,0,0,0.35)" },
  keyText: { fontFamily: Fonts.monoMedium, fontSize: 13, color: c.text },
  itemTitle: { fontFamily: Fonts.medium, fontSize: 14.5, color: c.text },
  itemDesc: { fontFamily: Fonts.regular, fontSize: 12.5, color: "#8B9CD8", marginTop: 1 },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  settingInfo: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1, minWidth: 220, flex: 1 },
  settingIcon: { width: 42, height: 42, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  settingControl: { flexShrink: 0 },
  snapBtn: { flexDirection: "row", alignItems: "center", gap: 18, height: 40, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, minWidth: 140, justifyContent: "space-between" },
  snapText: { fontFamily: Fonts.medium, fontSize: 14, color: c.text },
  segSmall: { width: 180 },
  segWide: { width: 270 },
  divider: { height: 1, backgroundColor: c.border },
  unsaved: { fontFamily: Fonts.regular, fontSize: 12.5, color: c.amber, textAlign: "center" },
}));
