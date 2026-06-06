import { InvalidTimestampError } from './errors.ts';
import { slugifyEntryContent } from './slugs.ts';

export type BuildEntryIdInput = {
  readonly text: string;
  readonly timestamp: Date | string;
  readonly segmentIndex?: number;
};

/**
 * Matches ISO 8601 date-time strings that carry an explicit offset (Z or ±HH:MM).
 * Groups: year, month, day, hour, minute, second — all as written in the string
 * (i.e. local wall-clock, not UTC-normalised).
 */
const ISO_WITH_OFFSET_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function extractLocalComponents(
  isoString: string,
  originalValue: string,
): { date: string; time: string } {
  const match = ISO_WITH_OFFSET_REGEX.exec(isoString);
  if (!match) {
    throw new InvalidTimestampError(originalValue);
  }
  const [, year, month, day, hour, minute, second] = match;
  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}${minute}${second}`,
  };
}

/**
 * Builds a deterministic, sortable Entry id from text, a capture timestamp, and
 * an optional segment index.
 *
 * Format: `YYYY-MM-DD-HHMMSS-<content-slug>[-N]`
 *
 * - Date/time components are read from the string's own offset (local wall-clock),
 *   so the id matches what the user saw at capture time.
 * - Passing a `Date` normalises to UTC via `.toISOString()` before extraction.
 * - `segmentIndex` > 0 appends a `-N` suffix to break same-second ties.
 * - Invalid or unparseable timestamps throw `InvalidTimestampError`; there is no
 *   silent fallback, because the id must stay sortable and deterministic.
 */
export function buildEntryId({ text, timestamp, segmentIndex }: BuildEntryIdInput): string {
  let isoString: string;
  let originalValue: string;

  if (timestamp instanceof Date) {
    if (isNaN(timestamp.getTime())) {
      throw new InvalidTimestampError(timestamp.toString());
    }
    isoString = timestamp.toISOString();
    originalValue = isoString;
  } else {
    isoString = timestamp;
    originalValue = timestamp;
  }

  const { date, time } = extractLocalComponents(isoString, originalValue);
  const contentSlug = slugifyEntryContent(text);

  const base = `${date}-${time}-${contentSlug}`;
  return segmentIndex !== undefined && segmentIndex > 0 ? `${base}-${segmentIndex}` : base;
}
