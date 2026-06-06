/**
 * Placeholder shared API-contract types between Siegmund's backend and clients.
 * These are intentionally minimal; they exist to anchor the cross-package
 * contract and will grow as the capture and pairing flows are built out.
 */

export const ENTRY_TYPES = ['thought', 'idea', 'task'] as const;

export type EntryType = (typeof ENTRY_TYPES)[number];

export interface CaptureRequest {
  text: string;
  type: EntryType;
}

export interface PairRequest {
  deviceName: string;
  pairingCode: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isCaptureRequest(value: unknown): value is CaptureRequest {
  if (!isRecord(value)) return false;
  return (
    typeof value.text === 'string' &&
    typeof value.type === 'string' &&
    (ENTRY_TYPES as readonly string[]).includes(value.type)
  );
}

export function isPairRequest(value: unknown): value is PairRequest {
  if (!isRecord(value)) return false;
  return typeof value.deviceName === 'string' && typeof value.pairingCode === 'string';
}
