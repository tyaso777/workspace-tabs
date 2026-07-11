export const MIN_WINDOW_WIDTH = 960;
export const MAX_WINDOW_WIDTH = 3840;
export const MIN_WINDOW_HEIGHT = 560;
export const MAX_WINDOW_HEIGHT = 2160;

export function normalizeWindowWidth(width: number) {
  if (!Number.isFinite(width)) {
    return MIN_WINDOW_WIDTH;
  }
  return Math.round(Math.min(MAX_WINDOW_WIDTH, Math.max(MIN_WINDOW_WIDTH, width)));
}

export function normalizeWindowHeight(height: number) {
  if (!Number.isFinite(height)) {
    return MIN_WINDOW_HEIGHT;
  }
  return Math.round(Math.min(MAX_WINDOW_HEIGHT, Math.max(MIN_WINDOW_HEIGHT, height)));
}
