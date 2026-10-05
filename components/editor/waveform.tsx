import { memo, useMemo } from "react";
import Svg, { Path } from "react-native-svg";
import type { WaveformDetail } from "@/store/types";
import { amplitude } from "@/utils/composite";

interface Props {
  seed: string;
  width: number;
  height: number;
  inPoint: number;
  sourceSpan: number;
  color: string;
  detail: WaveformDetail;
  gain: number;
}

const STEP: Record<WaveformDetail, number> = { simple: 7, medium: 4, detailed: 2.4 };

function WaveformBase({ seed, width, height, inPoint, sourceSpan, color, detail, gain }: Props) {
  const d = useMemo(() => {
    const step = STEP[detail];
    const bars = Math.max(2, Math.min(600, Math.floor(width / step)));
    const bw = Math.max(1, step * 0.6);
    const mid = height / 2;
    const g = Math.max(0.15, Math.min(1.3, gain));
    let path = "";
    for (let i = 0; i < bars; i++) {
      const t = inPoint + (i / bars) * sourceSpan;
      const a = amplitude(seed, t * 2.2) * g;
      const h = Math.max(1, Math.min(height - 2, a * (height - 4)));
      const x = i * step;
      path += `M${x.toFixed(1)} ${(mid - h / 2).toFixed(1)}h${bw.toFixed(1)}v${h.toFixed(1)}h-${bw.toFixed(1)}Z`;
    }
    return path;
  }, [seed, width, height, inPoint, sourceSpan, detail, gain]);

  if (width < 2) return null;
  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Path d={d} fill={color} />
    </Svg>
  );
}

export const Waveform = memo(WaveformBase);
