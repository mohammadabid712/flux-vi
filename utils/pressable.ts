import type { PressableStateCallbackType } from "react-native";

/** react-native-web adds `hovered` to Pressable state; native does not. */
export const isHovered = (state: PressableStateCallbackType): boolean =>
  !!(state as PressableStateCallbackType & { hovered?: boolean }).hovered;
