import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/hooks/use-theme";

interface Props {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
  accessibilityLabel: string;
}

/** Centered dialog: the backdrop is a sibling of the (non-interactive) panel. */
export function ModalPanel({ visible, onClose, children, maxWidth = 520, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined} style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close dialog"
        />
        <View
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
          style={[styles.panel, { maxWidth, backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(3,5,10,0.72)" },
  panel: {
    width: "100%",
    maxHeight: "92%",
    borderRadius: 16,
    borderWidth: 1,
    borderCurve: "continuous",
    overflow: "hidden",
    boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
  },
});
