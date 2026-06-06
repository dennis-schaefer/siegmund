import { describe, expect, it } from 'vitest';
import { buildFrontmatter, parseFrontmatter } from './frontmatter.ts';
import type { EntryFrontmatter } from './frontmatter.ts';
import { MalformedFrontmatterError } from './errors.ts';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FULL: EntryFrontmatter = {
  id: '2026-01-01-120000-test',
  title: 'Test Entry',
  type: 'thought',
  status: 'open',
  created: '2026-01-01T12:00:00+01:00',
  source: '',
  area: 'inbox',
  extras: {},
};

// ── buildFrontmatter — field emit order ───────────────────────────────────────

describe('buildFrontmatter — fixed emit order', () => {
  it('emits the 7 known fields in the canonical order', () => {
    const output = buildFrontmatter(FULL);
    const keys = output
      .split('\n')
      .filter((l) => l.includes(':') && !l.startsWith(' ') && !l.startsWith('-'))
      .map((l) => l.split(':')[0].trim());
    expect(keys).toEqual(['id', 'title', 'type', 'status', 'created', 'source', 'area']);
  });

  it('emits extras after the 7 known fields', () => {
    const fm: EntryFrontmatter = { ...FULL, extras: { priority: 3, tags: ['a', 'b'] } };
    const output = buildFrontmatter(fm);
    const areaIdx = output.indexOf('\narea:');
    const priorityIdx = output.indexOf('\npriority:');
    const tagsIdx = output.indexOf('\ntags:');
    expect(priorityIdx).toBeGreaterThan(areaIdx);
    expect(tagsIdx).toBeGreaterThan(areaIdx);
  });

  it('emits no YAML document fences (---)', () => {
    const output = buildFrontmatter(FULL);
    expect(output).not.toContain('---');
  });
});

// ── buildFrontmatter → parseFrontmatter round-trip ────────────────────────────

const unknownVocabCases: Array<{ label: string; fm: EntryFrontmatter }> = [
  {
    label: 'unknown type "recipe"',
    fm: { ...FULL, type: 'recipe', extras: {} },
  },
  {
    label: 'unknown status "archived"',
    fm: { ...FULL, status: 'archived', extras: {} },
  },
  {
    label: 'both unknown: type "recipe", status "archived"',
    fm: { ...FULL, type: 'recipe', status: 'archived', extras: {} },
  },
];

describe('buildFrontmatter → parseFrontmatter — unknown vocab survives', () => {
  it.each(unknownVocabCases)('$label', ({ fm }) => {
    const parsed = parseFrontmatter(buildFrontmatter(fm));
    expect(parsed.type).toBe(fm.type);
    expect(parsed.status).toBe(fm.status);
  });
});

const extrasCases: Array<{ label: string; extras: Record<string, unknown> }> = [
  { label: 'numeric extra', extras: { priority: 3 } },
  { label: 'array extra', extras: { tags: ['a', 'b'] } },
  { label: 'string extra', extras: { note: 'hello' } },
  { label: 'mixed extras', extras: { priority: 3, tags: ['a', 'b'] } },
  { label: 'empty extras', extras: {} },
];

describe('buildFrontmatter → parseFrontmatter — extras preserved by value', () => {
  it.each(extrasCases)('$label', ({ extras }) => {
    const fm: EntryFrontmatter = { ...FULL, extras };
    const parsed = parseFrontmatter(buildFrontmatter(fm));
    expect(parsed.extras).toEqual(extras);
  });
});

const KNOWN_KEYS = ['id', 'title', 'type', 'status', 'created', 'source', 'area'] as const;

describe('parseFrontmatter — extras never contains known keys', () => {
  it('known keys do not appear in extras', () => {
    const parsed = parseFrontmatter(buildFrontmatter(FULL));
    for (const key of KNOWN_KEYS) {
      expect(Object.prototype.hasOwnProperty.call(parsed.extras, key)).toBe(false);
    }
  });
});

// ── parseFrontmatter — defaults ───────────────────────────────────────────────

const defaultCases: Array<{
  label: string;
  yaml: string;
  field: keyof Omit<EntryFrontmatter, 'extras'>;
  expected: string;
}> = [
  {
    label: 'missing status → "open"',
    yaml: 'id: x\ntitle: t\ntype: task\ncreated: 2026-01-01\nsource: ""\narea: inbox\n',
    field: 'status',
    expected: 'open',
  },
  {
    label: 'missing area → "inbox"',
    yaml: 'id: x\ntitle: t\ntype: task\nstatus: open\ncreated: 2026-01-01\nsource: ""\n',
    field: 'area',
    expected: 'inbox',
  },
  {
    label: 'missing id → ""',
    yaml: 'title: t\ntype: task\nstatus: open\ncreated: 2026-01-01\nsource: ""\narea: inbox\n',
    field: 'id',
    expected: '',
  },
  {
    label: 'missing title → ""',
    yaml: 'id: x\ntype: task\nstatus: open\ncreated: 2026-01-01\nsource: ""\narea: inbox\n',
    field: 'title',
    expected: '',
  },
  {
    label: 'missing source → ""',
    yaml: 'id: x\ntitle: t\ntype: task\nstatus: open\ncreated: 2026-01-01\narea: inbox\n',
    field: 'source',
    expected: '',
  },
  {
    label: 'missing created → ""',
    yaml: 'id: x\ntitle: t\ntype: task\nstatus: open\nsource: ""\narea: inbox\n',
    field: 'created',
    expected: '',
  },
];

describe('parseFrontmatter — missing field defaults', () => {
  it.each(defaultCases)('$label', ({ yaml, field, expected }) => {
    const parsed = parseFrontmatter(yaml);
    expect(parsed[field]).toBe(expected);
  });

  it('treats a top-level YAML scalar as empty (isPlainObject fallback to {})', () => {
    const parsed = parseFrontmatter('just a string');
    expect(parsed.status).toBe('open');
    expect(parsed.area).toBe('inbox');
    expect(parsed.extras).toEqual({});
  });

  it('all fields default on completely empty YAML', () => {
    const parsed = parseFrontmatter('');
    expect(parsed.id).toBe('');
    expect(parsed.title).toBe('');
    expect(parsed.type).toBe('');
    expect(parsed.status).toBe('open');
    expect(parsed.created).toBe('');
    expect(parsed.source).toBe('');
    expect(parsed.area).toBe('inbox');
    expect(parsed.extras).toEqual({});
  });
});

describe('parseFrontmatter — non-string scalar coerced via String()', () => {
  const coerceCases: Array<{
    label: string;
    yaml: string;
    field: keyof Omit<EntryFrontmatter, 'extras'>;
    expected: string;
  }> = [
    { label: 'type: 1 → "1"', yaml: 'type: 1\n', field: 'type', expected: '1' },
    { label: 'status: 0 → "0"', yaml: 'status: 0\n', field: 'status', expected: '0' },
    { label: 'area: 42 → "42"', yaml: 'area: 42\n', field: 'area', expected: '42' },
  ];

  it.each(coerceCases)('$label', ({ yaml, field, expected }) => {
    const parsed = parseFrontmatter(yaml);
    expect(parsed[field]).toBe(expected);
  });
});

// ── parseFrontmatter — malformed YAML ─────────────────────────────────────────

const malformedCases: Array<{ label: string; yaml: string }> = [
  { label: 'unclosed flow sequence', yaml: 'key: [unclosed' },
  { label: 'unclosed flow mapping', yaml: 'key: {unclosed' },
  { label: 'tab indentation error', yaml: 'key:\n\t- value' },
];

describe('parseFrontmatter — malformed YAML → MalformedFrontmatterError', () => {
  it.each(malformedCases)('$label', ({ yaml }) => {
    expect(() => parseFrontmatter(yaml)).toThrow(MalformedFrontmatterError);
  });

  it('MalformedFrontmatterError is instanceof DomainError', () => {
    expect(() => parseFrontmatter('key: [unclosed')).toThrow(MalformedFrontmatterError);
  });
});
