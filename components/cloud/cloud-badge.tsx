import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Fonts } from "@/constants/Typography";
import { useTheme } from "@/hooks/use-theme";
import { useSyncStore } from "@/store/sync-store";
import type { SyncStatus } from "@/store/types";
import type { IconName } from "@/components/ui/button";

const LABELS: Record<SyncStatus, { full: string; short: string; icon: IconName }> = {
  local: { full: "Local Mode", short: "Local", icon: "flash" },
  pending: { full: "Unsaved changes", short: "Pending", icon: "ellipsis-horizontal-circle-outline" },
  syncing: { full: "Syncing...", short: "Syncing", icon: "sync" },
  saved: { full: "Saved to Cloud", short: "Saved", icon: "cloud-done-outline" },
  offline: { full: "Offline", short: "Offline", icon: "cloud-offline-outline" },
};

interface Props {
  compact?: boolean;
  onPress?: () => void;
}

/** Cloud sync status pill (☁ Saved to Cloud / ↻ Syncing... / ⚡ Local Mode / Offline). */
export function CloudBadge({ compact, onPress }: Props) {
  const { colors } = useTheme();
  const status = useSyncStore((s) => s.status);
  const error = useSyncStore((s) => s.error);
  const tone =
    status === "saved" ? colors.cyan : status === "offline" ? colors.red : status === "local" ? colors.amber : colors.primary;
  const label = LABELS[status];
  const a11y = status === "offline" && error ? `${label.full}: ${error}` : label.full;

  const body = (
    <View style={[styles.pill, { borderColor: `${tone}55`, backgroundColor: `${tone}1A` }]}>
      {status === "syncing" ? (
        <ActivityIndicator size={12} color={tone} />
      ) : (
        <Ionicons name={label.icon} size={14} color={tone} />
      )}
      <Text numberOfLines={1} style={[styles.text, { color: tone }]}>
        {compact ? label.short : label.full}
      </Text>
    </View>
  );

  if (!onPress) {
    return (
      <View accessibilityRole="text" accessibilityLabel={`Cloud status: ${a11y}`}>
        {body}
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Cloud status: ${a11y}. Open account`} hitSlop={6}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  text: { fontFamily: Fonts.semiBold, fontSize: 12 },
});
