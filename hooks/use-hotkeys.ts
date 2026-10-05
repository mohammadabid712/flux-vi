import { useEffect, useRef } from "react";

export interface HotkeyEvent {
  key: string;
  code: string;
  meta: boolean;
  shift: boolean;
  preventDefault: () => void;
}

interface KeyLike {
  key: string;
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  target: unknown;
  preventDefault: () => void;
}

interface Listenable {
  addEventListener?: (type: string, fn: (e: KeyLike) => void) => void;
  removeEventListener?: (type: string, fn: (e: KeyLike) => void) => void;
}

const isTyping = (target: unknown): boolean => {
  const t = target as { tagName?: string; isContentEditable?: boolean } | null;
  const tag = t?.tagName?.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!t?.isContentEditable;
};

/** Global keyboard shortcuts (web / hardware keyboards). No-op where unsupported. */
export function useHotkeys(handler: (e: HotkeyEvent) => void, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!enabled || process.env.EXPO_OS !== "web") return;
    const target = (typeof window !== "undefined" ? window : undefined) as Listenable | undefined;
    if (!target?.addEventListener) return;
    const listener = (e: KeyLike) => {
      if (isTyping(e.target)) return;
      ref.current({
        key: e.key,
        code: e.code,
        meta: e.metaKey || e.ctrlKey,
        shift: e.shiftKey,
        preventDefault: () => e.preventDefault(),
      });
    };
    target.addEventListener("keydown", listener);
    return () => target.removeEventListener?.("keydown", listener);
  }, [enabled]);
}
