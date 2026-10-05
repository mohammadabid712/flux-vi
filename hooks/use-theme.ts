import { Palettes, type Palette, type ThemeName } from "@/constants/theme";
import { useAppStore } from "@/store/useAppStore";

export function useTheme(): { theme: ThemeName; colors: Palette } {
  const theme = useAppStore((s) => s.preferences.theme);
  return { theme, colors: Palettes[theme] };
}
