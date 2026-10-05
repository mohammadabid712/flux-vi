import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { Fonts } from "@/constants/Typography";

interface ToastState {
  id: number;
  message: string;
  tone: "info" | "error" | "success";
}

/** Lightweight in-app toast; returns the node to render and a show() function. */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, tone: ToastState["tone"] = "info") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const node = toast ? (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View key={toast.id} entering={FadeInDown.duration(180)} exiting={FadeOutDown.duration(160)} style={styles.toast}>
        <Ionicons
          name={toast.tone === "error" ? "alert-circle" : toast.tone === "success" ? "checkmark-circle" : "information-circle"}
          size={17}
          color={toast.tone === "error" ? "#EF4444" : toast.tone === "success" ? "#10B981" : "#818CF8"}
        />
        <Text accessibilityLiveRegion="polite" style={styles.text}>{toast.message}</Text>
      </Animated.View>
    </View>
  ) : null;

  return { toastNode: node, showToast: show };
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 28, alignItems: "center", zIndex: 100 },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1D212A",
    borderColor: "#2A303C",
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    maxWidth: 420,
    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
  },
  text: { color: "#F8FAFC", fontFamily: Fonts.medium, fontSize: 13 },
});
