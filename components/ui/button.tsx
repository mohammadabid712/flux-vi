import { isHovered } from "@/utils/pressable";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Fonts } from "@/constants/Typography";
import { useTheme } from "@/hooks/use-theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

interface Props {
  label?: string;
  icon?: IconName;
  onPress: () => void;
  variant?: "primary" | "outline" | "ghost" | "danger" | "soft";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  active?: boolean;
  children?: ReactNode;
  flex?: boolean;
}

const SIZES = {
  sm: { h: 30, px: 10, font: 12, icon: 14, gap: 6, r: 8 },
  md: { h: 40, px: 14, font: 14, icon: 17, gap: 8, r: 10 },
  lg: { h: 50, px: 20, font: 16, icon: 19, gap: 10, r: 12 },
};

export function Button({
  label,
  icon,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  style,
  accessibilityLabel,
  active,
  children,
  flex,
}: Props) {
  const { colors } = useTheme();
  const s = SIZES[size];
  const isPrimary = variant === "primary" || active;
  const bg = isPrimary
    ? colors.primary
    : variant === "danger"
      ? "rgba(239,68,68,0.14)"
      : variant === "soft"
        ? colors.panel
        : "transparent";
  const fg = isPrimary ? colors.onPrimary : variant === "danger" ? colors.red : colors.text;
  const border = variant === "outline" && !active ? colors.border : "transparent";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled || !!loading, selected: !!active }}
      disabled={disabled || loading}
      onPress={onPress}
      hitSlop={size === "sm" ? 8 : 4}
      style={[flex && styles.flex, style]}
    >
      {(state) => {
        const { pressed } = state;
        const hovered = isHovered(state);
        return (
        <View
          style={[
            styles.base,
            {
              height: s.h,
              paddingHorizontal: label ? s.px : 0,
              width: label || children ? undefined : s.h,
              borderRadius: s.r,
              gap: s.gap,
              backgroundColor: bg,
              borderColor: border,
              opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
            },
            isPrimary && styles.glow,
            hovered && !isPrimary && { backgroundColor: colors.hover },
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={fg} />
          ) : icon ? (
            <Ionicons name={icon} size={s.icon} color={fg} />
          ) : null}
          {label ? (
            <Text numberOfLines={1} style={[styles.label, { color: fg, fontSize: s.font }]}>
              {label}
            </Text>
          ) : null}
          {children}
        </View>
      );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderCurve: "continuous",
  },
  glow: { boxShadow: "0 6px 18px rgba(99,102,241,0.35)" },
  label: { fontFamily: Fonts.semiBold },
});
