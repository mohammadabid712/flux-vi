import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { AspectOptions, aspectName } from "@/constants/presets";
import { Fonts } from "@/constants/Typography";
import { makeStyles } from "@/constants/theme";
import type { EditorActions } from "@/hooks/use-editor-actions";
import { useTheme } from "@/hooks/use-theme";
import { useEditorStore } from "@/store/editor-store";
import type { AspectRatio, Project } from "@/store/types";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { ModalPanel } from "@/components/ui/modal-panel";
import { Slider } from "@/components/ui/slider";
import { AccountButton } from "@/components/cloud/account-button";
import { CloudBadge } from "@/components/cloud/cloud-badge";

interface Props {
  project: Project;
  actions: EditorActions;
  compact: boolean;
  onBack: () => void;
  onExport: () => void;
  onShortcuts: () => void;
  onRename: (title: string) => void;
  onFormat: (ar: AspectRatio) => void;
  onAccount: () => void;
}

function BarIcon({ icon, label, onPress, disabled, active, mci }: { icon: string; label: string; onPress: () => void; disabled?: boolean; active?: boolean; mci?: boolean }) {
  const { theme, colors } = useTheme();
  const s = useStyles(theme);
  const color = disabled ? colors.subtle : active ? colors.cyan : colors.text;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled, selected: !!active }} hitSlop={6}>
      <View style={[s.iconBtn, active && s.iconBtnActive]}>
        {mci ? <MaterialCommunityIcons name={icon as never} size={19} color={color} /> : <Ionicons name={icon as never} size={19} color={color} />}
      </View>
    </Pressable>
  );
}

export function EditorTopBar({ project, actions, compact, onBack, onExport, onShortcuts, onRename, onFormat, onAccount }: Props) {
  const { theme, colors } = useTheme();
  const s = useStyles(theme);
  const snap = useEditorStore((st) => st.snap);
  const zoom = useEditorStore((st) => st.zoom);
  const setEditor = useEditorStore((st) => st.set);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState(project.title);
  const openMenu = () => {
    setDraft(project.title);
    setMenuOpen(true);
  };

  const past = project.history.past;
  const future = project.history.future;
  const undoLabel = past.at(-1)?.label;
  const redoLabel = future.at(-1)?.label;

  const controls = (
    <>
      <View style={s.group}>
        <BarIcon icon="arrow-undo-outline" label={undoLabel ? `Undo ${undoLabel}` : "Undo"} onPress={actions.undo} disabled={!undoLabel} />
        <BarIcon icon="arrow-redo-outline" label={redoLabel ? `Redo ${redoLabel}` : "Redo"} onPress={actions.redo} disabled={!redoLabel} />
        <View style={s.historyText}>
          <Text numberOfLines={1} style={s.historyLabel}>{undoLabel ?? "No edits yet"}</Text>
          <Text style={s.historyCount}>{past.length} / {past.length + future.length}</Text>
        </View>
      </View>
      <View style={s.group}>
        <BarIcon icon="magnet" mci label={`Snap ${snap ? "on" : "off"}`} active={snap} onPress={() => setEditor({ snap: !snap })} />
      </View>
      <View style={s.group}>
        <BarIcon icon="keypad-outline" label="Keyboard shortcuts" onPress={onShortcuts} />
      </View>
      <View style={[s.group, s.zoomGroup]}>
        <Ionicons name="search-outline" size={16} color={colors.muted} />
        <Pressable onPress={() => setEditor({ zoom: Math.max(0.25, zoom / 1.5) })} accessibilityRole="button" accessibilityLabel="Zoom out" hitSlop={8}>
          <Ionicons name="remove" size={17} color={colors.text} />
        </Pressable>
        <View style={s.zoomSlider}>
          <Slider value={Math.log2(zoom)} min={-2} max={3.6} step={0.05} accessibilityLabel="Zoom" color={colors.video1} trackColor={colors.border} onChange={(v) => setEditor({ zoom: 2 ** v })} />
        </View>
        <Pressable onPress={() => setEditor({ zoom: Math.min(12, zoom * 1.5) })} accessibilityRole="button" accessibilityLabel="Zoom in" hitSlop={8}>
          <Ionicons name="add" size={17} color={colors.text} />
        </Pressable>
      </View>
    </>
  );

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to projects" hitSlop={6}>
          <View style={s.back}>
            <Ionicons name="chevron-back" size={18} color={colors.muted} />
            <Logo size={compact ? 28 : 34} />
          </View>
        </Pressable>
        <Pressable onPress={openMenu} accessibilityRole="button" accessibilityLabel={`Project ${project.title}, format ${aspectName(project.aspectRatio)}. Change title or format`} style={s.titleWrap}>
          <View>
            <View style={s.titleRow}>
              <Text numberOfLines={1} style={[s.title, compact && { fontSize: 15 }]}>{project.title}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.muted} />
            </View>
            <View style={s.formatRow}>
              <Ionicons name="tv-outline" size={13} color={colors.muted} />
              <Text style={s.format}>{aspectName(project.aspectRatio)}</Text>
            </View>
          </View>
        </Pressable>
        {!compact ? <View style={s.controls}>{controls}</View> : null}
        {!compact ? <CloudBadge onPress={onAccount} /> : null}
        <AccountButton showLabel={false} />
        <Button label="Export" icon="rocket" onPress={onExport} size={compact ? "md" : "lg"} />
      </View>
      {compact ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.compactScroll} contentContainerStyle={s.compactControls}>
          <CloudBadge compact onPress={onAccount} />
          {controls}
        </ScrollView>
      ) : null}

      <ModalPanel visible={menuOpen} onClose={() => setMenuOpen(false)} maxWidth={420} accessibilityLabel="Project settings">
        <View style={s.menu}>
          <Text style={s.menuTitle}>Project</Text>
          <TextInput value={draft} onChangeText={setDraft} style={s.input} accessibilityLabel="Project title" placeholder="Project title" placeholderTextColor={colors.subtle} maxLength={60} />
          <Text style={s.menuLabel}>Canvas format</Text>
          <View style={s.formatList}>
            {AspectOptions.map((o) => {
              const on = o.value === project.aspectRatio;
              return (
                <Pressable key={o.value} onPress={() => onFormat(o.value)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={aspectName(o.value)}>
                  <View style={[s.formatItem, on && s.formatItemOn]}>
                    <Text style={s.formatItemText}>{aspectName(o.value)}</Text>
                    {on ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={s.menuActions}>
            <Button label="Close" variant="outline" onPress={() => setMenuOpen(false)} flex />
            <Button
              label="Save Title"
              onPress={() => {
                onRename(draft);
                setMenuOpen(false);
              }}
              flex
            />
          </View>
        </View>
      </ModalPanel>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  back: { flexDirection: "row", alignItems: "center", gap: 2 },
  titleWrap: { flexShrink: 1, flexGrow: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontFamily: Fonts.bold, fontSize: 18, color: c.text, flexShrink: 1 },
  formatRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 },
  format: { fontFamily: Fonts.regular, fontSize: 12, color: c.muted },
  controls: { flexDirection: "row", alignItems: "center", gap: 8 },
  compactScroll: { flexGrow: 0 },
  compactControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  group: { flexDirection: "row", alignItems: "center", gap: 2, height: 40, paddingHorizontal: 4, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  zoomGroup: { gap: 8, paddingHorizontal: 10 },
  zoomSlider: { width: 90, height: 24, flexDirection: "row" },
  iconBtn: { width: 34, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  iconBtnActive: { backgroundColor: "rgba(6,182,212,0.12)" },
  historyText: { paddingHorizontal: 6, maxWidth: 120 },
  historyLabel: { fontFamily: Fonts.medium, fontSize: 10.5, color: c.text },
  historyCount: { fontFamily: Fonts.mono, fontSize: 9.5, color: c.muted },
  menu: { padding: 18, gap: 10 },
  menuTitle: { fontFamily: Fonts.bold, fontSize: 17, color: c.text },
  menuLabel: { fontFamily: Fonts.semiBold, fontSize: 12, color: c.muted, marginTop: 6 },
  input: { height: 44, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, paddingHorizontal: 12, color: c.text, fontFamily: Fonts.medium, fontSize: 14 },
  formatList: { gap: 6 },
  formatItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel },
  formatItemOn: { borderColor: c.primary, backgroundColor: c.primarySoft },
  formatItemText: { fontFamily: Fonts.medium, fontSize: 13.5, color: c.text },
  menuActions: { flexDirection: "row", gap: 10, marginTop: 8 },
}));
