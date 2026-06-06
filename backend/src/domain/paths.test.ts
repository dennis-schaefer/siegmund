import { describe, expect, it } from 'vitest';
import { computeAreasIndexPath, computeEntryPath, computeHubPath } from './paths.ts';

describe('computeEntryPath', () => {
  const cases: Array<[string, string, string]> = [
    ['haushalt', '2024-01-01-120000-some-entry', '/areas/haushalt/entries/2024-01-01-120000-some-entry.md'],
    ['sw-projekt-x', '2024-06-01-090000-fix-bug', '/areas/sw-projekt-x/entries/2024-06-01-090000-fix-bug.md'],
  ];

  it.each(cases)('computeEntryPath(%j, %j) → %j', (area, id, expected) => {
    expect(computeEntryPath(area, id)).toBe(expected);
  });

  it('routes inbox entries to /inbox/<id>.md (no "entries/" segment)', () => {
    expect(computeEntryPath('inbox', '2024-01-01-120000-some-entry')).toBe(
      '/inbox/2024-01-01-120000-some-entry.md',
    );
  });

  it('uses forward-slash separators regardless of host OS', () => {
    const path = computeEntryPath('haushalt', 'some-id');
    expect(path).not.toContain('\\');
    expect(path.startsWith('/')).toBe(true);
  });
});

// ── computeHubPath ────────────────────────────────────────────────────────────

describe('computeHubPath', () => {
  it('returns /areas/<slug>/_hub.md', () => {
    expect(computeHubPath('haushalt')).toBe('/areas/haushalt/_hub.md');
  });

  it('works with multi-segment slugs', () => {
    expect(computeHubPath('sw-projekt-x')).toBe('/areas/sw-projekt-x/_hub.md');
  });

  it('uses forward-slash separators', () => {
    const path = computeHubPath('haushalt');
    expect(path).not.toContain('\\');
    expect(path.startsWith('/')).toBe(true);
  });
});

// ── computeAreasIndexPath ─────────────────────────────────────────────────────

describe('computeAreasIndexPath', () => {
  it('returns /_areas.md', () => {
    expect(computeAreasIndexPath()).toBe('/_areas.md');
  });
});
