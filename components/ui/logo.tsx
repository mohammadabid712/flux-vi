import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

interface Props {
  size?: number;
}

/** Veloce brand mark: a kinetic playhead aperture. */
export function Logo({ size = 36 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="Veloce logo">
      <Defs>
        <LinearGradient id="vg1" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#3B82F6" />
          <Stop offset="1" stopColor="#8B5CF6" />
        </LinearGradient>
        <LinearGradient id="vg2" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#6366F1" stopOpacity="0.95" />
          <Stop offset="1" stopColor="#A855F7" />
        </LinearGradient>
      </Defs>
      <Path d="M8 10c0-5 5-7.6 9.3-5.1l38 22.2c4.2 2.5 4.2 8.6 0 11.1l-38 22.2C13 62.9 8 60.1 8 55.2Z" fill="url(#vg1)" />
      <Path d="M22 20.5c0-2.4 2.6-3.9 4.7-2.7l20.5 11.9c2.1 1.2 2.1 4.2 0 5.4L26.7 47c-2.1 1.2-4.7-.3-4.7-2.7Z" fill="url(#vg2)" />
      <Path d="M30 27.6c0-1.2 1.3-1.9 2.3-1.3l8.6 5c1 .6 1 2 0 2.6l-8.6 5c-1 .6-2.3-.1-2.3-1.3Z" fill="#0D0F12" opacity="0.85" />
    </Svg>
  );
}
