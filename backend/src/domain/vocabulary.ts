import { ENTRY_TYPES } from '@siegmund/shared';
export type { EntryType } from '@siegmund/shared';

export const KNOWN_STATUSES = ['open', 'done', 'dropped'] as const;

export type KnownStatus = (typeof KNOWN_STATUSES)[number];

/**
 * Advisory guard — informational only, never rejects unknown input.
 * Returns true when the value is a recognised entry type from @siegmund/shared.
 */
export function isKnownType(value: unknown): value is (typeof ENTRY_TYPES)[number] {
  return typeof value === 'string' && (ENTRY_TYPES as readonly string[]).includes(value);
}

/**
 * Advisory guard — informational only, never rejects unknown input.
 * Returns true when the value is one of the known statuses.
 */
export function isKnownStatus(value: unknown): value is KnownStatus {
  return typeof value === 'string' && (KNOWN_STATUSES as readonly string[]).includes(value);
}
