import { describe, expect, it } from 'vitest';
import {
  slugifyAreaName,
  slugifyEntryContent,
  slugifyText,
  validateAreaName,
} from './slugs.ts';
import { InvalidAreaNameError, ReservedAreaNameError } from './errors.ts';
import type { Area, RenderableArea } from './area.ts';

// ── slugifyText ──────────────────────────────────────────────────────────────

describe('slugifyText — German transliteration table', () => {
  const cases: Array<[string, string]> = [
    ['Müller', 'mueller'],
    ['Straße', 'strasse'],
    ['Öl', 'oel'],
    ['Ärger', 'aerger'],
    ['Café', 'cafe'],
    // Uppercase variants
    ['ÜBER', 'ueber'],
    ['Österreich', 'oesterreich'],
  ];

  it.each(cases)('slugifyText(%j) → %j', (input, expected) => {
    expect(slugifyText(input)).toBe(expected);
  });

  it('returns empty string when nothing survives normalization', () => {
    expect(slugifyText('')).toBe('');
    expect(slugifyText('!!!')).toBe('');
  });

  it('produces lowercase dash-separated output', () => {
    expect(slugifyText('Hello World')).toBe('hello-world');
  });
});

// ── slugifyEntryContent ──────────────────────────────────────────────────────

describe('slugifyEntryContent', () => {
  it('returns "entry" for empty string', () => {
    expect(slugifyEntryContent('')).toBe('entry');
  });

  it('returns "entry" for symbol-only input', () => {
    expect(slugifyEntryContent('!!! ??? ###')).toBe('entry');
  });

  it('uses first 6 words at most', () => {
    const result = slugifyEntryContent('one two three four five six seven eight');
    expect(result).toBe('one-two-three-four-five-six');
  });

  it('is capped at ~50 chars', () => {
    const longInput = 'alpha bravo charlie delta echo foxtrot';
    const result = slugifyEntryContent(longInput);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it('never emits a trailing dash', () => {
    const inputs = [
      'one two three four five six',
      'hello world',
      'a b c d e f g',
      'über alles hinaus weit draußen unten oben',
    ];
    for (const input of inputs) {
      expect(slugifyEntryContent(input)).not.toMatch(/-$/);
    }
  });

  it('truncates on a word boundary, not mid-word', () => {
    // 6 words that together produce > 50 chars after slugification
    const input = 'antidisestablishmentarianism supercalifragilistic pneumonoultramicroscopic foo bar baz';
    const result = slugifyEntryContent(input);
    expect(result.length).toBeLessThanOrEqual(50);
    expect(result).not.toMatch(/-$/);
  });

  it('handles German text correctly', () => {
    const result = slugifyEntryContent('Müller kauft Öl');
    expect(result).toBe('mueller-kauft-oel');
  });
});

// ── slugifyAreaName ──────────────────────────────────────────────────────────

describe('slugifyAreaName', () => {
  it('slugifies without validation or throwing', () => {
    expect(slugifyAreaName('SW Projekt X')).toBe('sw-projekt-x');
  });

  it('does not throw on reserved names', () => {
    expect(() => slugifyAreaName('inbox')).not.toThrow();
    expect(() => slugifyAreaName('areas')).not.toThrow();
  });

  it('does not throw on empty input', () => {
    expect(() => slugifyAreaName('')).not.toThrow();
    expect(slugifyAreaName('')).toBe('');
  });
});

// ── validateAreaName ─────────────────────────────────────────────────────────

describe('validateAreaName — valid names', () => {
  it('returns slug and trimmed title for "SW Projekt X"', () => {
    const result = validateAreaName('SW Projekt X');
    expect(result).toEqual<Area>({ slug: 'sw-projekt-x', title: 'SW Projekt X' });
  });

  it('trims whitespace from the title', () => {
    const result = validateAreaName('  Haushalt  ');
    expect(result).toEqual<Area>({ slug: 'haushalt', title: 'Haushalt' });
  });

  it('handles German names correctly', () => {
    const result = validateAreaName('Müller Projekt');
    expect(result).toEqual<Area>({ slug: 'mueller-projekt', title: 'Müller Projekt' });
  });
});

describe('validateAreaName — reserved names → ReservedAreaNameError', () => {
  const reservedCases: Array<[string]> = [['Inbox'], ['inbox'], ['Areas'], ['areas']];

  it.each(reservedCases)('validateAreaName(%j) throws ReservedAreaNameError', (name) => {
    expect(() => validateAreaName(name)).toThrow(ReservedAreaNameError);
  });
});

describe('validateAreaName — invalid names → InvalidAreaNameError', () => {
  const invalidCases: Array<[string]> = [[''], ['   '], ['!!!']];

  it.each(invalidCases)('validateAreaName(%j) throws InvalidAreaNameError', (name) => {
    expect(() => validateAreaName(name)).toThrow(InvalidAreaNameError);
  });
});

// ── type shape checks ────────────────────────────────────────────────────────

describe('Area and RenderableArea types', () => {
  it('Area has slug and title', () => {
    const area: Area = { slug: 'test', title: 'Test' };
    expect(area.slug).toBe('test');
    expect(area.title).toBe('Test');
  });

  it('RenderableArea extends Area with entryCount', () => {
    const renderable: RenderableArea = { slug: 'test', title: 'Test', entryCount: 3 };
    expect(renderable.entryCount).toBe(3);
  });
});
