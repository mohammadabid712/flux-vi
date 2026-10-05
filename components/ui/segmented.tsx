import { isHovered } from "@/utils/pressable";
import { Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Fonts } from "@/constants/Typography";
import { useTheme } from "@/hooks/use-theme";

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
}

interface Props<T extends string | number> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel: string;
  variant?: "pills" | "joined";
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
  wrap?: boolean;
}

/** Pill / segmented selector used across export, inspector and settings. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  accessibilityLabel,
  variant = "pills",
  size = "md",
  style,
  wrap,
}: Props<T>) {
  const { colors } = useTheme();
  const h = size === "sm" ? 30 : 40;
  const joined = variant === "joined";
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.row,
        wrap && styles.wrap,
        joined && { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 3, gap: 2 },
        style,
      ]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={wrap ? styles.wrapItem : styles.item}
            hitSlop={4}
          >
            {(state) => {
        const hovered = isHovered(state);
        return (
              <View
                style={[
                  styles.pill,
                  {
                    height: joined ? h - 6 : h,
                    borderRadius: joined ? 8 : 10,
                    backgroundColor: selected ? colors.primary : hovered ? colors.hover : joined ? "transparent" : colors.panel,
                    borderColor: selected || joined ? "transparent" : colors.border,
                  },
                  selected && styles.glow,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.text,
                    { color: selected ? colors.onPrimary : colors.text, fontSize: size === "sm" ? 11.5 : 13.5 },
                  ]}
                >
                  {o.label}
                </Text>
              </View>
            );
            }}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  wrap: { flexWrap: "wrap" },
  item: { flex: 1 },
  wrapItem: { flexGrow: 1, minWidth: 56 },
  pill: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    borderWidth: 1,
    borderCurve: "continuous",
  },
  glow: { boxShadow: "0 4px 14px rgba(99,102,241,0.35)" },
  text: { fontFamily: Fonts.medium },
});
