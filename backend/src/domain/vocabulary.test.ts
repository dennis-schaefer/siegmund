import { describe, expect, it } from 'vitest';
import {
  KNOWN_STATUSES,
  isKnownStatus,
  isKnownType,
} from './vocabulary.ts';
import { ENTRY_TYPES } from '@siegmund/shared';

describe('KNOWN_STATUSES', () => {
  it('equals the expected tuple', () => {
    expect(KNOWN_STATUSES).toEqual(['open', 'done', 'dropped']);
  });

  it('has exactly three elements', () => {
    expect(KNOWN_STATUSES).toHaveLength(3);
  });
});

describe('isKnownStatus', () => {
  const validCases: Array<[unknown, boolean]> = [
    ['open', true],
    ['done', true],
    ['dropped', true],
    ['pending', false],
    ['', false],
    [null, false],
    [undefined, false],
    [42, false],
    [{}, false],
    [[], false],
  ];

  it.each(validCases)('isKnownStatus(%o) → %s', (input, expected) => {
    expect(isKnownStatus(input)).toBe(expected);
  });

  it('never throws on any input', () => {
    const weirdInputs: unknown[] = [Symbol('x'), () => {}, NaN, Infinity, -0];
    for (const input of weirdInputs) {
      expect(() => isKnownStatus(input)).not.toThrow();
    }
  });
});

describe('isKnownType', () => {
  const validCases: Array<[unknown, boolean]> = [
    ...ENTRY_TYPES.map((t): [unknown, boolean] => [t, true]),
    ['unknown-type', false],
    ['', false],
    [null, false],
    [undefined, false],
    [0, false],
    [{}, false],
  ];

  it.each(validCases)('isKnownType(%o) → %s', (input, expected) => {
    expect(isKnownType(input)).toBe(expected);
  });

  it('never throws on any input', () => {
    const weirdInputs: unknown[] = [Symbol('x'), () => {}, NaN, Infinity];
    for (const input of weirdInputs) {
      expect(() => isKnownType(input)).not.toThrow();
    }
  });
});
