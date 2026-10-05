import { useAuth } from "@fastshot/auth";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Toggle } from "@/components/ui/toggle";
import { Fonts } from "@/constants/Typography";
import { useTheme } from "@/hooks/use-theme";
import { STORAGE_QUOTA_BYTES } from "@/lib/supabase";
import { errorMessage, formatBytes } from "@/services/cloud";
import { flushSync, refreshProfile, syncNow } from "@/services/sync-engine";
import { useSyncStore } from "@/store/sync-store";
import { useAppStore, useVisibleProjects } from "@/store/useAppStore";
import { relativeTime } from "@/utils/timecode";
import { CloudBadge } from "./cloud-badge";
import { initialsFor } from "./account-button";

interface Props {
  onSignedOut: () => void;
  notify: (msg: string, tone: "info" | "error" | "success") => void;
}

export function AccountPanel({ onSignedOut, notify }: Props) {
  const { colors } = useTheme();
  const { user, signOut } = useAuth();
  const profile = useSyncStore((s) => s.profile);
  const profileError = useSyncStore((s) => s.profileError);
  const status = useSyncStore((s) => s.status);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const syncError = useSyncStore((s) => s.error);
  const cloudVersions = useAppStore((s) => s.cloudVersions);
  const userMedia = useAppStore((s) => s.userMedia);
  const projects = useVisibleProjects();
  const [keepCache, setKeepCache] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const uid = user?.id ?? "";
  const stats = useMemo(() => {
    const synced = projects.filter((p) => cloudVersions[p.id] === p.updatedAt).length;
    const uploads = userMedia.filter((m) => m.ownerId === uid && m.cloudId);
    const localBytes = uploads.reduce((a, m) => a + (m.sizeBytes ?? 0), 0);
    return { synced, total: projects.length, uploads: uploads.length, localBytes };
  }, [projects, cloudVersions, userMedia, uid]);

  if (!user) return null;
  const used = profile?.storageUsedBytes ?? stats.localBytes;
  const pct = Math.min(100, (used / STORAGE_QUOTA_BYTES) * 100);
  const name = profile?.displayName || user.email?.split("@")[0] || "Creator";

  const doSignOut = async () => {
    setConfirmOpen(false);
    setSigningOut(true);
    setSignOutError(null);
    try {
      // Push outstanding edits first so nothing is lost when the session ends.
      const flushed = await flushSync();
      if (!flushed && !keepCache) {
        setSignOutError("Some edits haven't reached the cloud yet. Keep the local cache or reconnect before clearing it.");
        return;
      }
      await signOut();
      if (!keepCache) useAppStore.getState().clearOwnerCache(uid);
      onSignedOut();
    } catch (e) {
      console.error("Sign out failed", e);
      setSignOutError(errorMessage(e, "Unable to sign out. Please try again."));
    } finally {
      setSigningOut(false);
    }
  };

  const copyId = async () => {
    try {
      await Clipboard.setStringAsync(user.id);
      notify("User ID copied", "success");
    } catch (e) {
      console.error("Copy failed", e);
      notify("Could not copy user ID", "error");
    }
  };

  const manualSync = async () => {
    await syncNow(true);
    await refreshProfile();
    const st = useSyncStore.getState();
    notify(st.status === "offline" ? st.error ?? "Sync failed" : "Synced with cloud", st.status === "offline" ? "error" : "success");
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.identity}>
        <View style={[styles.avatar, { backgroundColor: colors.primary, boxShadow: "0 8px 24px rgba(99,102,241,0.45)" }]}>
          <Text style={styles.avatarText}>{initialsFor(profile?.displayName, user.email)}</Text>
        </View>
        <View style={styles.identityText}>
          <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{name}</Text>
          <Text selectable numberOfLines={1} style={[styles.email, { color: colors.muted }]}>{user.email}</Text>
          <Pressable onPress={copyId} accessibilityRole="button" accessibilityLabel="Copy user ID" hitSlop={8}>
            <View style={[styles.idBadge, { borderColor: colors.border, backgroundColor: colors.panel }]}>
              <Ionicons name="finger-print-outline" size={12} color={colors.cyan} />
              <Text style={[styles.idText, { color: colors.muted }]}>ID {user.id.slice(0, 8)}…</Text>
              <Ionicons name="copy-outline" size={12} color={colors.subtle} />
            </View>
          </Pressable>
        </View>
      </View>
      {profileError ? (
        <Text selectable style={[styles.warn, { color: colors.amber }]}>{profileError}</Text>
      ) : null}

      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.panel }]}>
        <View style={styles.cardRow}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Cloud Sync</Text>
          <CloudBadge />
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: colors.text }]}>{stats.synced}<Text style={{ color: colors.subtle }}>/{stats.total}</Text></Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Projects synced</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: colors.text }]}>{stats.uploads}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Cloud uploads</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: colors.text }]}>{lastSyncedAt ? relativeTime(lastSyncedAt) : "—"}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Last sync</Text>
          </View>
        </View>
        {status === "offline" && syncError ? (
          <Text selectable style={[styles.warn, { color: colors.red }]}>{syncError}</Text>
        ) : null}
        <Button label="Sync with Cloud" icon="sync" variant="outline" onPress={manualSync} loading={status === "syncing"} />
      </View>

      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.panel }]}>
        <View style={styles.cardRow}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Storage · project-media</Text>
          {profile ? null : <ActivityIndicator size="small" color={colors.cyan} />}
        </View>
        <View style={[styles.meter, { backgroundColor: colors.border }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}>
          <View style={[styles.meterFill, { width: `${Math.max(pct, 0.8)}%`, backgroundColor: pct > 85 ? colors.amber : colors.cyan }]} />
        </View>
        <Text style={[styles.meterText, { color: colors.muted }]}>
          {formatBytes(used)} / {formatBytes(STORAGE_QUOTA_BYTES)} used on Supabase
        </Text>
      </View>

      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.panel }]}>
        <View style={styles.cardRow}>
          <View style={styles.flex}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Keep local cache</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>
              {keepCache ? "Projects stay cached (hidden) on this device after sign out." : "Remove this account's projects from this device on sign out."}
            </Text>
          </View>
          <Toggle value={keepCache} onChange={setKeepCache} accessibilityLabel="Keep local cache after sign out" color={colors.primary} offColor={colors.border} />
        </View>
        {signOutError ? (
          <Text selectable accessibilityRole="alert" style={[styles.warn, { color: colors.red }]}>{signOutError}</Text>
        ) : null}
        <Button label="Sign Out" icon="log-out-outline" variant="danger" onPress={() => setConfirmOpen(true)} loading={signingOut} />
      </View>

      <ConfirmDialog
        visible={confirmOpen}
        title="Sign out of Flux VI?"
        message={
          keepCache
            ? "Your projects are safe in the cloud. This device keeps a private cached copy and returns to guest mode."
            : "Your projects are safe in the cloud. Cached copies on this device will be removed."
        }
        confirmLabel="Sign Out"
        destructive
        onConfirm={doSignOut}
        onCancel={() => setConfirmOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  flex: { flex: 1, gap: 2 },
  identity: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: Fonts.bold, fontSize: 21, color: "#fff" },
  identityText: { flex: 1, gap: 3, alignItems: "flex-start" },
  name: { fontFamily: Fonts.bold, fontSize: 18 },
  email: { fontFamily: Fonts.regular, fontSize: 13.5 },
  idBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, height: 24, marginTop: 3 },
  idText: { fontFamily: Fonts.mono, fontSize: 11 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 12, borderCurve: "continuous" },
  cardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  cardTitle: { fontFamily: Fonts.semiBold, fontSize: 14.5 },
  statsRow: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, gap: 2 },
  statNum: { fontFamily: Fonts.bold, fontSize: 16, fontVariant: ["tabular-nums"] },
  statLabel: { fontFamily: Fonts.regular, fontSize: 12, lineHeight: 16 },
  meter: { height: 8, borderRadius: 4, overflow: "hidden" },
  meterFill: { height: 8, borderRadius: 4 },
  meterText: { fontFamily: Fonts.medium, fontSize: 12.5 },
  warn: { fontFamily: Fonts.medium, fontSize: 12.5, lineHeight: 17 },
});
