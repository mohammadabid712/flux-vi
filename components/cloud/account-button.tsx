import { useAuth } from "@fastshot/auth";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Fonts } from "@/constants/Typography";
import { useTheme } from "@/hooks/use-theme";
import { useSyncStore } from "@/store/sync-store";

export const initialsFor = (name: string | null | undefined, email: string | null | undefined): string => {
  const src = (name || email || "?").trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
};

interface Props {
  /** Show the email / CTA text next to the avatar. */
  showLabel?: boolean;
}

/** Header account control: avatar + email when signed in, "Sign In / Register" CTA in guest mode. */
export function AccountButton({ showLabel = true }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const profile = useSyncStore((s) => s.profile);
  const open = useCallback(() => router.push("/auth"), [router]);

  if (!user) {
    return (
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel="Sign In or Register" hitSlop={4}>
        {({ pressed }) => (
          <View style={[styles.cta, { borderColor: colors.primary, backgroundColor: colors.primarySoft }, pressed && styles.pressed]}>
            <Ionicons name="person-circle-outline" size={18} color={colors.text} />
            {showLabel ? <Text style={[styles.ctaText, { color: colors.text }]}>Sign In / Register</Text> : null}
          </View>
        )}
      </Pressable>
    );
  }

  const name = profile?.displayName ?? null;
  return (
    <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`Account ${user.email ?? ""}`} hitSlop={4}>
      {({ pressed }) => (
        <View style={[styles.account, { borderColor: colors.border, backgroundColor: colors.surface }, pressed && styles.pressed]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{initialsFor(name, user.email)}</Text>
          </View>
          {showLabel ? (
            <Text numberOfLines={1} style={[styles.email, { color: colors.text }]}>
              {user.email}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cta: { flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  ctaText: { fontFamily: Fonts.semiBold, fontSize: 13 },
  account: { flexDirection: "row", alignItems: "center", gap: 8, height: 40, paddingLeft: 4, paddingRight: 10, borderRadius: 999, borderWidth: 1, maxWidth: 220 },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: Fonts.bold, fontSize: 12, color: "#fff" },
  email: { fontFamily: Fonts.medium, fontSize: 12.5, flexShrink: 1 },
  pressed: { opacity: 0.8 },
});
