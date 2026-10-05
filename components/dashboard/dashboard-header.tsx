import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { Fonts } from "@/constants/Typography";
import { makeStyles } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

interface Props {
  onNewProject: () => void;
  compact: boolean;
}

export function DashboardHeader({ onNewProject, compact }: Props) {
  const { theme, colors } = useTheme();
  const s = useStyles(theme);
  const setPreference = useAppStore((st) => st.setPreference);

  return (
    <View style={s.row}>
      <View style={s.brand}>
        <Logo size={compact ? 34 : 40} />
        <View>
          <Text style={[s.title, compact && { fontSize: 19 }]}>Veloce</Text>
          <Text style={s.sub}>Video Studio</Text>
        </View>
        <View style={s.pro}>
          <Text style={s.proText}>PRO</Text>
        </View>
      </View>
      <View style={s.right}>
        <View style={s.themeToggle} accessibilityRole="radiogroup" accessibilityLabel="Theme">
          {(["light", "dark"] as const).map((t) => (
            <Pressable
              key={t}
              accessibilityRole="radio"
              accessibilityLabel={t === "light" ? "Light theme" : "Dark theme"}
              accessibilityState={{ checked: theme === t }}
              onPress={() => setPreference("theme", t)}
              hitSlop={6}
            >
              <View style={[s.themeKnob, theme === t && { backgroundColor: colors.hover }]}>
                <Ionicons
                  name={t === "light" ? "sunny-outline" : "moon"}
                  size={15}
                  color={theme === t ? colors.text : colors.muted}
                />
              </View>
            </Pressable>
          ))}
        </View>
        <Button
          label={compact ? "New" : "New Project"}
          icon="add"
          onPress={onNewProject}
          accessibilityLabel="New Project"
          size={compact ? "md" : "lg"}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  title: { fontFamily: Fonts.bold, fontSize: 22, color: c.text, letterSpacing: -0.3 },
  sub: { fontFamily: Fonts.medium, fontSize: 12.5, color: c.muted, marginTop: -2 },
  pro: { backgroundColor: c.primary, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginLeft: 2, alignSelf: "flex-start", marginTop: 4 },
  proText: { fontFamily: Fonts.bold, fontSize: 10.5, color: "#fff", letterSpacing: 0.6 },
  right: { flexDirection: "row", alignItems: "center", gap: 10 },
  themeToggle: { flexDirection: "row", borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 3, gap: 2 },
  themeKnob: { width: 30, height: 28, borderRadius: 999, alignItems: "center", justifyContent: "center" },
}));

