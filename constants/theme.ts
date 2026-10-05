import { StyleSheet } from "react-native";

export interface Palette {
  bg: string;
  surface: string;
  panel: string;
  hover: string;
  border: string;
  text: string;
  muted: string;
  subtle: string;
  primary: string;
  primarySoft: string;
  cyan: string;
  amber: string;
  red: string;
  green: string;
  video1: string;
  video2: string;
  audio1: string;
  audio2: string;
  textTrack: string;
  onPrimary: string;
  canvas: string;
}

export type ThemeName = "dark" | "light";

const shared = {
  primary: "#6366F1",
  cyan: "#06B6D4",
  amber: "#F59E0B",
  red: "#EF4444",
  green: "#10B981",
  video1: "#3B82F6",
  video2: "#8B5CF6",
  audio1: "#10B981",
  audio2: "#14B8A6",
  textTrack: "#F59E0B",
  onPrimary: "#FFFFFF",
  canvas: "#050608",
};

export const Palettes: Record<ThemeName, Palette> = {
  dark: {
    ...shared,
    bg: "#090A0F",
    surface: "#12141F",
    panel: "#181B29",
    hover: "#232842",
    border: "#1E2235",
    text: "#F8FAFC",
    muted: "#94A3B8",
    subtle: "#64748B",
    primarySoft: "rgba(99,102,241,0.18)",
  },
  light: {
    ...shared,
    bg: "#F3F5F9",
    surface: "#FFFFFF",
    panel: "#EEF1F6",
    hover: "#E2E6EE",
    border: "#D8DEE8",
    text: "#0F172A",
    muted: "#5B6B82",
    subtle: "#94A3B8",
    primarySoft: "rgba(99,102,241,0.12)",
  },
};

export const Radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;
export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24 } as const;

/**
 * Creates a themed StyleSheet factory. Styles are cached per theme so
 * components can call the returned hook on every render cheaply.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (c: Palette) => T,
): (theme: ThemeName) => T {
  const cache: Partial<Record<ThemeName, T>> = {};
  return (theme: ThemeName) => {
    const hit = cache[theme];
    if (hit) return hit;
    const created = StyleSheet.create(factory(Palettes[theme]));
    cache[theme] = created;
    return created;
  };
}
