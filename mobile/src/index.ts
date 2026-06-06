import type { CaptureRequest } from '@siegmund/shared';

export const appName = 'Siegmund';

/**
 * Placeholder client-side helper: turns raw user text into a capture draft.
 * Real clients will let the user pick the type; the default keeps this minimal.
 */
export function buildCaptureDraft(rawText: string): CaptureRequest {
  return { text: rawText.trim(), type: 'thought' };
}
