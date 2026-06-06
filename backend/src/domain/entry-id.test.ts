import { describe, expect, it } from 'vitest';
import { buildEntryId } from './entry-id.ts';
import { InvalidTimestampError } from './errors.ts';

const OFFSET_ISO = '2026-06-06T14:32:07+02:00';
const TEXT = 'Milch kaufen';
const EXPECTED_BASE_ID = '2026-06-06-143207-milch-kaufen';

// ── Criterion 1: basic id shape ────────────────────────────────────────────────

describe('buildEntryId — basic id', () => {
  it('produces the correct id for Milch kaufen at +02:00 offset', () => {
    expect(buildEntryId({ text: TEXT, timestamp: OFFSET_ISO })).toBe(EXPECTED_BASE_ID);
  });
});

// ── Criterion 2: local wall-clock, not UTC ─────────────────────────────────────

describe('buildEntryId — uses offset wall-clock time, not UTC', () => {
  it('uses 14:32:07 from +02:00 offset, not the UTC-shifted 12:32:07', () => {
    const id = buildEntryId({ text: TEXT, timestamp: OFFSET_ISO });
    expect(id).toContain('143207');
    expect(id).not.toContain('123207');
  });
});

// ── Criterion 3: Date and ISO-string equivalence ───────────────────────────────

describe('buildEntryId — Date and ISO-string equivalence', () => {
  it('produces the same id from a UTC ISO string and an equivalent Date object', () => {
    const utcIso = '2026-06-06T12:32:07Z';
    const date = new Date(utcIso);
    expect(buildEntryId({ text: TEXT, timestamp: utcIso })).toBe(
      buildEntryId({ text: TEXT, timestamp: date }),
    );
  });
});

// ── Criterion 4: segmentIndex suffix ──────────────────────────────────────────

describe('buildEntryId — segmentIndex suffix', () => {
  it('appends -1 when segmentIndex is 1 (minimum truthy value)', () => {
    expect(buildEntryId({ text: TEXT, timestamp: OFFSET_ISO, segmentIndex: 1 })).toBe(
      `${EXPECTED_BASE_ID}-1`,
    );
  });

  it('appends -2 when segmentIndex is 2', () => {
    expect(buildEntryId({ text: TEXT, timestamp: OFFSET_ISO, segmentIndex: 2 })).toBe(
      `${EXPECTED_BASE_ID}-2`,
    );
  });

  it('does not append a suffix when segmentIndex is 0', () => {
    expect(buildEntryId({ text: TEXT, timestamp: OFFSET_ISO, segmentIndex: 0 })).toBe(
      EXPECTED_BASE_ID,
    );
  });

  it('does not append a suffix when segmentIndex is absent', () => {
    expect(buildEntryId({ text: TEXT, timestamp: OFFSET_ISO })).toBe(EXPECTED_BASE_ID);
  });
});

// ── Criterion 5: empty / symbol-only text fallback ────────────────────────────

describe('buildEntryId — empty or symbol-only text falls back to "entry"', () => {
  it('uses "entry" slug for empty text', () => {
    expect(buildEntryId({ text: '', timestamp: OFFSET_ISO })).toBe(
      '2026-06-06-143207-entry',
    );
  });

  it('uses "entry" slug for symbol-only text', () => {
    expect(buildEntryId({ text: '!!! ???', timestamp: OFFSET_ISO })).toBe(
      '2026-06-06-143207-entry',
    );
  });
});

// ── Criterion 6: invalid timestamp → InvalidTimestampError ────────────────────

describe('buildEntryId — invalid timestamp', () => {
  const invalidCases: Array<[string, Date | string]> = [
    ['non-ISO string', 'not-a-date'],
    ['plain date without time', '2026-06-06'],
    ['empty string', ''],
    ['invalid Date object', new Date('invalid')],
  ];

  it.each(invalidCases)('throws InvalidTimestampError for %s', (_label, timestamp) => {
    expect(() => buildEntryId({ text: TEXT, timestamp })).toThrow(InvalidTimestampError);
  });
});
