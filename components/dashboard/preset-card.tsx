import { isHovered } from "@/utils/pressable";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import { Artwork } from "@/constants/media";
import type { QuickPreset } from "@/constants/presets";
import { Fonts } from "@/constants/Typography";
import { makeStyles } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

interface Props {
  preset: QuickPreset;
  onPress: (p: QuickPreset) => void;
  width?: number;
}

function Badge({ kind }: { kind: QuickPreset["badge"] }) {
  switch (kind) {
    case "youtube":
      return (
        <View style={[badge.base, { backgroundColor: "#0B0B0F" }]}>
          <View style={badge.yt}>
            <Ionicons name="play" size={10} color="#fff" />
          </View>
        </View>
      );
    case "tiktok":
      return (
        <View style={[badge.base, { backgroundColor: "#0B0B0F" }]}>
          <Ionicons name="logo-tiktok" size={16} color="#fff" />
        </View>
      );
    case "instagram":
      return (
        <View style={[badge.base, { backgroundColor: "#0B0B0F" }]}>
          <View style={badge.ig}>
            <Ionicons name="logo-instagram" size={14} color="#fff" />
          </View>
        </View>
      );
    case "vlog":
      return (
        <View style={[badge.base, { backgroundColor: "#0B0B0F" }]}>
          <Ionicons name="play-circle-outline" size={20} color="#fff" />
        </View>
      );
    default:
      return (
        <View style={[badge.base, { backgroundColor: "#0B0B0F" }]}>
          <MaterialCommunityIcons name="waveform" size={18} color="#fff" />
        </View>
      );
  }
}

const badge = {
  base: { width: 32, height: 32, borderRadius: 16, alignItems: "center" as const, justifyContent: "center" as const, borderWidth: 2, borderColor: "#16191F" },
  yt: { backgroundColor: "#EF1C1C", width: 22, height: 15, borderRadius: 4, alignItems: "center" as const, justifyContent: "center" as const },
  ig: { backgroundColor: "#E1306C", width: 20, height: 20, borderRadius: 6, alignItems: "center" as const, justifyContent: "center" as const },
};

export function PresetCard({ preset, onPress, width }: Props) {
  const { theme } = useTheme();
  const s = useStyles(theme);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`New ${preset.name} project, ${preset.spec}`}
      onPress={() => onPress(preset)}
      style={width ? { width } : { flex: 1 }}
    >
      {(state) => {
        const { pressed } = state;
        const hovered = isHovered(state);
        return (
        <View style={[s.card, (hovered || pressed) && s.cardActive]}>
          <View style={s.thumbWrap}>
            <Image source={Artwork[preset.artwork]} style={s.thumb} contentFit="cover" transition={150} />
            <View style={s.badgeSlot}>
              <Badge kind={preset.badge} />
            </View>
          </View>
          <Text numberOfLines={1} style={s.name}>{preset.name}</Text>
          <Text style={s.spec}>{preset.spec}</Text>
        </View>
      );
      }}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    padding: 6,
    paddingBottom: 12,
    alignItems: "center",
    borderCurve: "continuous",
  },
  cardActive: { borderColor: c.primary, backgroundColor: c.panel },
  thumbWrap: { width: "100%", marginBottom: 20 },
  thumb: { width: "100%", aspectRatio: 1.32, borderRadius: 8 },
  badgeSlot: { position: "absolute", bottom: -16, left: 0, right: 0, alignItems: "center" },
  name: { fontFamily: Fonts.semiBold, fontSize: 13, color: c.text, paddingHorizontal: 4 },
  spec: { fontFamily: Fonts.regular, fontSize: 12, color: c.muted, marginTop: 4 },
}));
