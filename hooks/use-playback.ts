import { useEffect } from "react";
import { useEditorStore } from "@/store/editor-store";

/** Drives the playhead with requestAnimationFrame while playing. */
export function usePlayback(duration: number) {
  const isPlaying = useEditorStore((s) => s.isPlaying);

  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const st = useEditorStore.getState();
      let t = st.currentTime + dt * st.rate * st.speedPreset;
      if (duration <= 0) {
        st.set({ isPlaying: false, currentTime: 0 });
        return;
      }
      if (t >= duration) {
        if (st.loop) t = 0;
        else {
          st.set({ currentTime: duration, isPlaying: false, rate: 1 });
          return;
        }
      } else if (t <= 0 && st.rate < 0) {
        st.set({ currentTime: 0, isPlaying: false, rate: 1 });
        return;
      }
      st.set({ currentTime: t });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, duration]);
}
