import { useRef, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { useDrag } from "@/hooks/use-drag";

interface Props {
  value: number;
  min: number;
  max: number;
  step?: number;
  color?: string;
  trackColor?: string;
  disabled?: boolean;
  accessibilityLabel: string;
  /** Called continuously while dragging. */
  onChange: (v: number) => void;
  /** Called once when the gesture ends. */
  onComplete?: (v: number) => void;
  height?: number;
}

const THUMB = 12;

export function Slider({
  value,
  min,
  max,
  step = 0,
  color = "#3B82F6",
  trackColor = "#2A303C",
  disabled,
  accessibilityLabel,
  onChange,
  onComplete,
  height = 24,
}: Props) {
  const [width, setWidth] = useState(0);
  const startX = useRef(0);
  const last = useRef(value);

  const toValue = (x: number) => {
    if (width <= 0) return min;
    const r = Math.max(0, Math.min(1, x / width));
    let v = min + r * (max - min);
    if (step > 0) v = Math.round(v / step) * step;
    return Math.max(min, Math.min(max, v));
  };

  const drag = useDrag({
    disabled,
    onStart: ({ locationX }) => {
      startX.current = locationX;
      const v = toValue(locationX);
      last.current = v;
      onChange(v);
    },
    onMove: (dx) => {
      const v = toValue(startX.current + dx);
      if (v !== last.current) {
        last.current = v;
        onChange(v);
      }
    },
    onEnd: () => onComplete?.(last.current),
  });

  const ratio = max === min ? 0 : (Math.max(min, Math.min(max, value)) - min) / (max - min);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const nudge = (dir: 1 | -1) => {
    const inc = step > 0 ? step : (max - min) / 20;
    const v = Math.max(min, Math.min(max, value + dir * inc));
    onChange(v);
    onComplete?.(v);
  };

  return (
    <View
      style={[styles.hit, { height, opacity: disabled ? 0.4 : 1 }]}
      onLayout={onLayout}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: Math.round(value * 100) / 100 }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === "increment" ? 1 : -1)}
      {...drag}
    >
      <View pointerEvents="none" style={[styles.track, { backgroundColor: trackColor }]}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          { left: ratio * width - THUMB / 2, backgroundColor: color, top: height / 2 - THUMB / 2 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { justifyContent: "center", flex: 1, minWidth: 40 },
  track: { height: 3, borderRadius: 2, overflow: "hidden" },
  fill: { height: 3, borderRadius: 2 },
  thumb: {
    position: "absolute",
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 2,
    borderColor: "#E0E7FF",
    boxShadow: "0 0 8px rgba(59,130,246,0.6)",
  },
});
