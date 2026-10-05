import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Fonts } from "@/constants/Typography";
import { useTheme } from "@/hooks/use-theme";
import { Button, type IconName } from "./button";

export function LoadingState({ label = "Loading studio…" }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={[styles.body, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

interface MessageProps {
  icon?: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  fill?: boolean;
}

export function MessageState({ icon = "alert-circle-outline", title, message, actionLabel, onAction, secondaryLabel, onSecondary, fill = true }: MessageProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.center, fill && { flex: 1, backgroundColor: colors.bg }, !fill && styles.inline]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <Text selectable style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text selectable style={[styles.body, { color: colors.muted }]}>{message}</Text>
      <View style={styles.actions}>
        {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
        {secondaryLabel && onSecondary ? <Button label={secondaryLabel} variant="outline" onPress={onSecondary} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  inline: { flex: 0, paddingVertical: 32 },
  iconWrap: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title: { fontFamily: Fonts.bold, fontSize: 17, textAlign: "center" },
  body: { fontFamily: Fonts.regular, fontSize: 13.5, textAlign: "center", maxWidth: 320, lineHeight: 20 },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
});
