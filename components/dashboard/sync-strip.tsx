import { useAuth } from "@fastshot/auth";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import { CloudBadge } from "@/components/cloud/cloud-badge";
import { Button } from "@/components/ui/button";
import { Fonts } from "@/constants/Typography";
import { makeStyles } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { refreshProfile, syncNow } from "@/services/sync-engine";
import { useSyncStore } from "@/store/sync-store";
import { relativeTime } from "@/utils/timecode";

interface Props {
  notify: (msg: string, tone: "info" | "error" | "success") => void;
}

/** Cloud status row under the dashboard header with a manual "Sync with Cloud" action. */
export function SyncStrip({ notify }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { theme, colors } = useTheme();
  const s = useStyles(theme);
  const status = useSyncStore((st) => st.status);
  const error = useSyncStore((st) => st.error);
  const lastSyncedAt = useSyncStore((st) => st.lastSyncedAt);
  const cloudCount = useSyncStore((st) => st.cloudProjectCount);

  const onSync = useCallback(async () => {
    await syncNow(true);
    await refreshProfile();
    const st = useSyncStore.getState();
    if (st.status === "offline") notify(st.error ?? "Sync failed", "error");
    else notify("Synced with cloud", "success");
  }, [notify]);

  const openAuth = useCallback(() => router.push("/auth"), [router]);

  if (!user) {
    return (
      <View style={s.strip}>
        <CloudBadge onPress={openAuth} />
        <Text style={s.text} numberOfLines={2}>
          Drafts are saved on this device only. Sign in to back up and sync across devices.
        </Text>
        <Pressable onPress={openAuth} accessibilityRole="button" accessibilityLabel="Sign in to enable cloud sync" hitSlop={8}>
          <View style={s.link}>
            <Text style={[s.linkText, { color: colors.primary }]}>Enable Cloud</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.primary} />
          </View>
        </Pressable>
      </View>
    );
  }

  const detail =
    status === "offline"
      ? error ?? "Cloud unreachable — changes are kept locally"
      : `${cloudCount} cloud project${cloudCount === 1 ? "" : "s"}${lastSyncedAt ? ` · synced ${relativeTime(lastSyncedAt)}` : ""}`;

  return (
    <View style={s.strip}>
      <CloudBadge onPress={openAuth} />
      <Text style={[s.text, status === "offline" && { color: colors.red }]} numberOfLines={2} selectable>
        {detail}
      </Text>
      <Button label="Sync with Cloud" icon="sync" variant="outline" size="sm" onPress={onSync} loading={status === "syncing"} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    flexWrap: "wrap",
  },
  text: { flex: 1, minWidth: 140, fontFamily: Fonts.regular, fontSize: 12.5, color: c.muted },
  link: { flexDirection: "row", alignItems: "center", gap: 4, height: 32 },
  linkText: { fontFamily: Fonts.semiBold, fontSize: 13 },
}));
