import { isHovered } from "@/utils/pressable";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { Artwork } from "@/constants/media";
import { resolutionLabel } from "@/constants/presets";
import { Fonts } from "@/constants/Typography";
import { makeStyles } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { Project } from "@/store/types";
import { relativeTime, toClock } from "@/utils/timecode";

interface Props {
  project: Project;
  layout: "grid" | "list";
  syncState: "local" | "synced" | "pending";
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

function Action({ icon, label, onPress, color }: { icon: "copy-outline" | "trash-outline"; label: string; onPress: () => void; color: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8}>
      {(state) => {
        const hovered = isHovered(state);
        return (
        <View style={[actionStyle.row, hovered && { opacity: 0.75 }]}>
          <Ionicons name={icon} size={16} color={color} />
          <Text style={[actionStyle.text, { color }]}>{label.split(" ")[0]}</Text>
        </View>
      );
      }}
    </Pressable>
  );
}

const actionStyle = {
  row: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, height: 36, paddingHorizontal: 4 },
  text: { fontFamily: Fonts.medium, fontSize: 13 },
};

function ProjectCardBase({ project, layout, syncState, onEdit, onDuplicate, onDelete }: Props) {
  const { theme, colors } = useTheme();
  const s = useStyles(theme);
  const list = layout === "list";
  const res = resolutionLabel(project.resolution.width, project.resolution.height);
  return (
    <View style={[s.card, list && s.cardList]}>
      <View style={s.top}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${project.title}`} onPress={() => onEdit(project.id)}>
          <View style={[s.thumbWrap, list && s.thumbList]}>
            <Image source={Artwork[project.coverArt]} style={s.thumb} contentFit="cover" transition={150} />
            <View style={s.duration}>
              <Text style={s.durationText}>{toClock(project.duration)}</Text>
            </View>
          </View>
        </Pressable>
        <View style={s.info}>
          <View style={s.titleRow}>
            <Text numberOfLines={1} style={s.title}>{project.title}</Text>
            <Ionicons
              name={syncState === "synced" ? "cloud-done" : syncState === "pending" ? "cloud-upload-outline" : "phone-portrait-outline"}
              size={15}
              color={syncState === "synced" ? colors.cyan : syncState === "pending" ? colors.primary : colors.muted}
              accessibilityLabel={syncState === "synced" ? "Synced to cloud" : syncState === "pending" ? "Waiting to sync" : "Local draft"}
            />
          </View>
          <Text style={s.meta}>
            {project.aspectRatio}  •  {project.tracks.length} tracks
          </Text>
          <Text style={s.meta}>
            {res} {project.frameRate}fps
          </Text>
          <View style={s.modified}>
            <Ionicons name="time-outline" size={14} color={colors.muted} />
            <Text style={s.modText}>Modified {relativeTime(project.updatedAt)}</Text>
          </View>
        </View>
      </View>
      <View style={[s.actions, list && s.actionsList]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${project.title}`} onPress={() => onEdit(project.id)}>
          {(state) => {
          const { pressed } = state;
          return (
            <View style={[s.edit, pressed && { opacity: 0.8 }]}>
              <Ionicons name="play" size={15} color="#fff" />
              <Text style={s.editText}>Edit</Text>
            </View>
          );
          }}
        </Pressable>
        <Action icon="copy-outline" label="Duplicate project" onPress={() => onDuplicate(project.id)} color={colors.muted} />
        <Action icon="trash-outline" label="Delete project" onPress={() => onDelete(project.id)} color={colors.muted} />
      </View>
    </View>
  );
}

export const ProjectCard = memo(ProjectCardBase);

const useStyles = makeStyles((c) => ({
  card: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    padding: 12,
    gap: 12,
    borderCurve: "continuous",
  },
  cardList: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" },
  top: { flexDirection: "row", gap: 12, flexShrink: 1 },
  thumbWrap: { width: 108, height: 92, borderRadius: 8, overflow: "hidden", backgroundColor: c.panel },
  thumbList: { width: 84, height: 60 },
  thumb: { width: "100%", height: "100%" },
  duration: { position: "absolute", right: 5, bottom: 5, backgroundColor: "rgba(0,0,0,0.78)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  durationText: { fontFamily: Fonts.monoMedium, fontSize: 11, color: "#fff" },
  info: { flex: 1, gap: 3, paddingTop: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  title: { fontFamily: Fonts.semiBold, fontSize: 15, color: c.text, flexShrink: 1 },
  meta: { fontFamily: Fonts.regular, fontSize: 12.5, color: c.muted },
  modified: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  modText: { fontFamily: Fonts.regular, fontSize: 12, color: c.muted },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  actionsList: { gap: 14 },
  edit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: c.primary,
    height: 38,
    paddingHorizontal: 20,
    borderRadius: 10,
    boxShadow: "0 6px 16px rgba(99,102,241,0.35)",
  },
  editText: { fontFamily: Fonts.semiBold, fontSize: 14, color: "#fff" },
}));
