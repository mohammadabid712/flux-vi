import { useAuth } from "@fastshot/auth";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccountPanel } from "@/components/cloud/account-panel";
import { AuthForms } from "@/components/cloud/auth-forms";
import { Logo } from "@/components/ui/logo";
import { LoadingState } from "@/components/ui/state-views";
import { useToast } from "@/components/ui/toast";
import { Fonts } from "@/constants/Typography";
import { useTheme } from "@/hooks/use-theme";
import { useSyncStore } from "@/store/sync-store";

export default function AuthModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, isInitializing } = useAuth();
  const { toastNode, showToast } = useToast();

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [router]);

  if (isInitializing) return <LoadingState label="Checking your session…" />;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        >
          <View style={styles.inner}>
            <View style={styles.header}>
              <Logo size={40} />
              <View style={styles.flex}>
                <Text style={[styles.title, { color: colors.text }]}>{user ? "Your Account" : "Flux VI Cloud"}</Text>
                <Text style={[styles.sub, { color: colors.muted }]}>Cloud Sync & User Account</Text>
              </View>
              <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
                <View style={[styles.close, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                  <Ionicons name="close" size={20} color={colors.text} />
                </View>
              </Pressable>
            </View>

            {!user ? (
              <View style={styles.perks}>
                {[
                  { icon: "cloud-done-outline" as const, text: "Auto-save every edit to your private cloud" },
                  { icon: "phone-portrait-outline" as const, text: "Open projects on any browser or device" },
                  { icon: "lock-closed-outline" as const, text: "Row-level security keeps your media yours" },
                ].map((p) => (
                  <View key={p.text} style={styles.perk}>
                    <Ionicons name={p.icon} size={16} color={colors.cyan} />
                    <Text style={[styles.perkText, { color: colors.muted }]}>{p.text}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {user ? (
                <AccountPanel
                  notify={showToast}
                  onSignedOut={() => {
                    useSyncStore.getState().set({ notice: "Signed out — now in Local Mode" });
                    close();
                  }}
                />
              ) : (
                <AuthForms onSignedIn={close} onGuest={close} />
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {toastNode}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, alignItems: "center" },
  inner: { width: "100%", maxWidth: 460, gap: 18 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontFamily: Fonts.bold, fontSize: 22, letterSpacing: -0.3 },
  sub: { fontFamily: Fonts.regular, fontSize: 13 },
  close: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  perks: { gap: 8 },
  perk: { flexDirection: "row", alignItems: "center", gap: 10 },
  perkText: { fontFamily: Fonts.medium, fontSize: 13 },
  card: { borderRadius: 18, borderWidth: 1, padding: 18, borderCurve: "continuous", boxShadow: "0 18px 48px rgba(0,0,0,0.35)" },
});
