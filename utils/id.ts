import * as Crypto from "expo-crypto";

let counter = 0;

/** UUID v4 via expo-crypto, with a time+counter fallback if the native module is unavailable. */
export const newId = (): string => {
  try {
    const id = Crypto.randomUUID();
    if (id) return id;
  } catch (e) {
    console.error("randomUUID unavailable, using fallback id", e);
  }
  counter += 1;
  return `id-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};
