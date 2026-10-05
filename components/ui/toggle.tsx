import { Pressable, StyleSheet, View } from "react-native";

interface Props {
  value: boolean;
  onChange: (v: boolean) => void;
  accessibilityLabel: string;
  color?: string;
  offColor?: string;
  size?: "sm" | "md";
}

export function Toggle({ value, onChange, accessibilityLabel, color = "#3B82F6", offColor = "#2A303C", size = "md" }: Props) {
  const w = size === "sm" ? 30 : 36;
  const h = size === "sm" ? 16 : 20;
  const k = h - 6;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      hitSlop={12}
    >
      <View style={[styles.track, { width: w, height: h, borderRadius: h / 2, backgroundColor: value ? color : offColor }]}>
        <View
          style={[
            styles.knob,
            { width: k, height: k, borderRadius: k / 2, transform: [{ translateX: value ? w - k - 3 : 3 }] },
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { justifyContent: "center" },
  knob: { backgroundColor: "#F8FAFC", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" },
});
