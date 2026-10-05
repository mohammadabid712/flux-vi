import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { Fonts } from "@/constants/Typography";
import { useTheme } from "@/hooks/use-theme";
import type { IconName } from "@/components/ui/button";

interface Props extends Omit<TextInputProps, "style"> {
  label: string;
  icon: IconName;
  error?: string | null;
  secure?: boolean;
}

export function FormField({ label, icon, error, secure, ...input }: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const border = error ? colors.red : focused ? colors.primary : colors.border;
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <View style={[styles.box, { borderColor: border, backgroundColor: colors.panel }]}>
        <Ionicons name={icon} size={17} color={focused ? colors.primary : colors.subtle} />
        <TextInput
          {...input}
          accessibilityLabel={label}
          secureTextEntry={secure ? hidden : false}
          placeholderTextColor={colors.subtle}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[styles.input, { color: colors.text }]}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? `Show ${label.toLowerCase()}` : `Hide ${label.toLowerCase()}`}
            hitSlop={10}
          >
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={18} color={colors.subtle} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={[styles.error, { color: colors.red }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: Fonts.semiBold, fontSize: 12, letterSpacing: 0.3 },
  box: { flexDirection: "row", alignItems: "center", gap: 10, height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
  input: { flex: 1, height: 46, fontFamily: Fonts.medium, fontSize: 14.5 },
  error: { fontFamily: Fonts.medium, fontSize: 12 },
});
