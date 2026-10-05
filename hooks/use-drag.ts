import { useRef } from "react";
import type { GestureResponderEvent, GestureResponderHandlers } from "react-native";

export interface DragCallbacks {
  /** locationX/Y are relative to the element that received the press. */
  onStart?: (e: { locationX: number; locationY: number }) => void;
  onMove?: (dx: number, dy: number) => void;
  onEnd?: (dx: number, dy: number) => void;
  disabled?: boolean;
}

type DragProps = Pick<
  GestureResponderHandlers,
  | "onStartShouldSetResponder"
  | "onMoveShouldSetResponder"
  | "onResponderTerminationRequest"
  | "onResponderGrant"
  | "onResponderMove"
  | "onResponderRelease"
  | "onResponderTerminate"
>;

/**
 * Minimal drag recogniser built on the raw responder props (works on web + native).
 * Handlers are recreated every render, so they always see the latest props.
 */
export function useDrag({ onStart, onMove, onEnd, disabled }: DragCallbacks): DragProps {
  const origin = useRef({ x: 0, y: 0, dx: 0, dy: 0 });
  const delta = (e: GestureResponderEvent) => {
    origin.current.dx = e.nativeEvent.pageX - origin.current.x;
    origin.current.dy = e.nativeEvent.pageY - origin.current.y;
    return origin.current;
  };
  return {
    onStartShouldSetResponder: () => !disabled,
    onMoveShouldSetResponder: () => !disabled,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e) => {
      origin.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, dx: 0, dy: 0 };
      onStart?.({ locationX: e.nativeEvent.locationX, locationY: e.nativeEvent.locationY });
    },
    onResponderMove: (e) => {
      const d = delta(e);
      onMove?.(d.dx, d.dy);
    },
    onResponderRelease: (e) => {
      const d = delta(e);
      onEnd?.(d.dx, d.dy);
    },
    onResponderTerminate: () => onEnd?.(origin.current.dx, origin.current.dy),
  };
}
