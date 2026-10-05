/** Native: no metadata probe without a player instance; callers fall back to sensible defaults. */
export function probeDuration(_uri: string, fallback: number): Promise<number> {
  return Promise.resolve(fallback);
}
