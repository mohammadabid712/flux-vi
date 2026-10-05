import { StyleSheet, Text, View } from "react-native";
import { Fonts } from "@/constants/Typography";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "./button";
import { ModalPanel } from "./modal-panel";

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ visible, title, message, confirmLabel, destructive, onConfirm, onCancel }: Props) {
  const { colors } = useTheme();
  return (
    <ModalPanel visible={visible} onClose={onCancel} maxWidth={400} accessibilityLabel={title}>
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.msg, { color: colors.muted }]}>{message}</Text>
        <View style={styles.row}>
          <Button label="Cancel" variant="outline" onPress={onCancel} flex />
          <Button label={confirmLabel} variant={destructive ? "danger" : "primary"} onPress={onConfirm} flex />
        </View>
      </View>
    </ModalPanel>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 10 },
  title: { fontFamily: Fonts.bold, fontSize: 17 },
  msg: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: "row", gap: 10, marginTop: 10 },
});
