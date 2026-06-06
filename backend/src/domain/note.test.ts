import { describe, expect, it } from 'vitest';
import { buildNote, parseNote } from './note.ts';
import type { Entry } from './note.ts';
import type { EntryFrontmatter } from './frontmatter.ts';
import { MalformedFrontmatterError } from './errors.ts';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_FM: EntryFrontmatter = {
  id: '2026-01-01-120000-test',
  title: 'Test Entry',
  type: 'thought',
  status: 'open',
  created: '2026-01-01T12:00:00+01:00',
  source: '',
  area: 'inbox',
  extras: {},
};

const BASE_ENTRY: Entry = { frontmatter: BASE_FM, body: 'This is the body.' };

// ── buildNote — format ────────────────────────────────────────────────────────

describe('buildNote — note structure', () => {
  it('starts with opening ---', () => {
    expect(buildNote(BASE_ENTRY)).toMatch(/^---\n/);
  });

  it('has closing --- followed by blank line then body', () => {
    const note = buildNote(BASE_ENTRY);
    expect(note).toContain('\n---\n\n');
  });

  it('ends with body text', () => {
    const note = buildNote(BASE_ENTRY);
    expect(note).toMatch(/This is the body\.$/) ;
  });

  it('does not add H1 to body', () => {
    const note = buildNote(BASE_ENTRY);
    // No line starting with # followed by space in the body section
    const bodySection = note.split('\n---\n\n')[1] ?? '';
    expect(bodySection).not.toMatch(/^#\s/m);
  });
});

// ── parseNote(buildNote(e)) round-trip ────────────────────────────────────────

const roundTripCases: Array<{ label: string; entry: Entry }> = [
  {
    label: 'entry without extras',
    entry: BASE_ENTRY,
  },
  {
    label: 'entry with numeric and array extras',
    entry: {
      frontmatter: { ...BASE_FM, extras: { priority: 3, tags: ['a', 'b'] } },
      body: 'Entry with extras.',
    },
  },
  {
    label: 'entry with unknown type and status',
    entry: {
      frontmatter: { ...BASE_FM, type: 'recipe', status: 'archived', extras: {} },
      body: 'Recipe entry.',
    },
  },
  {
    label: 'entry with empty body',
    entry: {
      frontmatter: BASE_FM,
      body: '',
    },
  },
  {
    label: 'entry with multi-line body',
    entry: {
      frontmatter: BASE_FM,
      body: 'Line one.\nLine two.\nLine three.',
    },
  },
];

describe('parseNote(buildNote(e)) — round-trip is value-preserving', () => {
  it.each(roundTripCases)('$label', ({ entry }) => {
    const parsed = parseNote(buildNote(entry));
    expect(parsed).toEqual(entry);
  });
});

// ── parseNote — no-frontmatter input ─────────────────────────────────────────

const noFrontmatterCases: Array<{ label: string; text: string }> = [
  { label: 'plain text', text: 'Just some plain text.' },
  { label: 'multi-line text', text: 'Line 1.\nLine 2.\nLine 3.' },
  { label: 'text with blank lines', text: 'First.\n\nSecond paragraph.' },
  { label: 'empty string', text: '' },
];

describe('parseNote — no-frontmatter input → defaults + whole text as body', () => {
  it.each(noFrontmatterCases)('$label: whole text becomes body', ({ text }) => {
    const result = parseNote(text);
    expect(result.body).toBe(text);
  });

  it.each(noFrontmatterCases)('$label: defaults applied', ({ text }) => {
    const result = parseNote(text);
    expect(result.frontmatter.status).toBe('open');
    expect(result.frontmatter.area).toBe('inbox');
  });
});

// ── parseNote — body containing --- ──────────────────────────────────────────

const bodyWithSeparatorCases: Array<{ label: string; body: string }> = [
  { label: 'body with --- in middle', body: 'Part 1\n---\nPart 2' },
  { label: 'body starting with ---', body: '---\nStarting with separator' },
  { label: 'body with multiple ---', body: 'Intro\n---\nMiddle\n---\nEnd' },
];

describe('parseNote — body containing --- round-trips correctly', () => {
  it.each(bodyWithSeparatorCases)('$label', ({ body }) => {
    const entry: Entry = { frontmatter: BASE_FM, body };
    const parsed = parseNote(buildNote(entry));
    expect(parsed.body).toBe(body);
  });
});

// ── parseNote — missing closing fence (tolerant) ──────────────────────────────

const missingClosingFenceCases: Array<{ label: string; text: string }> = [
  {
    label: 'opening fence only with content',
    text: '---\nid: abc\ntitle: something',
  },
  {
    label: 'opening fence only, no content',
    text: '---\n',
  },
  {
    label: 'opening fence with partial YAML',
    text: '---\nid: abc\nstatus: open\nsource: capture',
  },
];

describe('parseNote — missing closing fence → tolerant (whole text as body)', () => {
  it.each(missingClosingFenceCases)('$label: whole text becomes body', ({ text }) => {
    const result = parseNote(text);
    expect(result.body).toBe(text);
  });

  it.each(missingClosingFenceCases)('$label: default frontmatter applied', ({ text }) => {
    const result = parseNote(text);
    expect(result.frontmatter.status).toBe('open');
    expect(result.frontmatter.area).toBe('inbox');
    expect(result.frontmatter.extras).toEqual({});
  });
});

// ── parseNote — malformed YAML ────────────────────────────────────────────────

const malformedNoteCases: Array<{ label: string; text: string }> = [
  {
    label: 'unclosed flow sequence in frontmatter',
    text: '---\nkey: [unclosed\n---\n\nbody',
  },
  {
    label: 'unclosed flow mapping in frontmatter',
    text: '---\nkey: {unclosed\n---\n\nbody',
  },
];

describe('parseNote — malformed YAML → MalformedFrontmatterError', () => {
  it.each(malformedNoteCases)('$label', ({ text }) => {
    expect(() => parseNote(text)).toThrow(MalformedFrontmatterError);
  });
});
