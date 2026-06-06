import { describe, expect, it } from 'vitest';
import type { RenderableArea } from './area.ts';
import { renderAreasIndex, renderHub } from './hub.ts';

// ── renderHub ─────────────────────────────────────────────────────────────────

describe('renderHub — placeholder substitution', () => {
  it('substitutes {{areaTitle}} in the template', () => {
    const result = renderHub(
      { title: 'Haushalt', slug: 'haushalt' },
      'Title: {{areaTitle}}',
    );
    expect(result).toBe('Title: Haushalt');
  });

  it('substitutes {{areaSlug}} in the template', () => {
    const result = renderHub(
      { title: 'Haushalt', slug: 'haushalt' },
      'Slug: {{areaSlug}}',
    );
    expect(result).toBe('Slug: haushalt');
  });

  it('substitutes multiple occurrences of both placeholders', () => {
    const template = '# {{areaTitle}}\npath: areas/{{areaSlug}}/_hub\ntitle: {{areaTitle}}';
    const result = renderHub({ title: 'SW Projekt X', slug: 'sw-projekt-x' }, template);
    expect(result).toBe('# SW Projekt X\npath: areas/sw-projekt-x/_hub\ntitle: SW Projekt X');
  });

  it('leaves unknown placeholders untouched', () => {
    const template = '{{areaTitle}} — {{unknownPlaceholder}}';
    const result = renderHub({ title: 'Haushalt', slug: 'haushalt' }, template);
    expect(result).toBe('Haushalt — {{unknownPlaceholder}}');
  });

  it('does not recursively expand a title that contains a placeholder pattern', () => {
    // If title is "{{areaSlug}}", a naive multi-pass would replace it again.
    const result = renderHub(
      { title: '{{areaSlug}}', slug: 'real-slug' },
      '{{areaTitle}} / {{areaSlug}}',
    );
    // Single-pass: {{areaTitle}} → literal "{{areaSlug}}", NOT further expanded.
    expect(result).toBe('{{areaSlug}} / real-slug');
  });
});

// ── renderAreasIndex ──────────────────────────────────────────────────────────

describe('renderAreasIndex', () => {
  const areas: RenderableArea[] = [
    { slug: 'haushalt', title: 'Haushalt', entryCount: 3 },
    { slug: 'sw-projekt-x', title: 'SW Projekt X', entryCount: 7 },
  ];

  it('renders each area using the default item template and joins by newline', () => {
    const result = renderAreasIndex(areas, '{{areaList}}');
    expect(result).toBe(
      '- [[areas/haushalt/_hub|Haushalt]]\n- [[areas/sw-projekt-x/_hub|SW Projekt X]]',
    );
  });

  it('substitutes the rendered list into the list placeholder in the outer template', () => {
    const result = renderAreasIndex(areas, '# Areas\n{{areaList}}\nEnd');
    expect(result).toBe(
      '# Areas\n- [[areas/haushalt/_hub|Haushalt]]\n- [[areas/sw-projekt-x/_hub|SW Projekt X]]\nEnd',
    );
  });

  it('produces an empty string in the list placeholder when the area list is empty', () => {
    const result = renderAreasIndex([], '# Areas\n{{areaList}}\nEnd');
    expect(result).toBe('# Areas\n\nEnd');
  });

  it('accepts a custom item template', () => {
    const result = renderAreasIndex(areas, '{{areaList}}', {
      itemTemplate: '* {{areaTitle}} ({{areaSlug}})',
    });
    expect(result).toBe('* Haushalt (haushalt)\n* SW Projekt X (sw-projekt-x)');
  });

  it('accepts a custom list placeholder', () => {
    const result = renderAreasIndex(areas, 'LIST: {{myList}}', {
      listPlaceholder: '{{myList}}',
    });
    expect(result).toBe(
      'LIST: - [[areas/haushalt/_hub|Haushalt]]\n- [[areas/sw-projekt-x/_hub|SW Projekt X]]',
    );
  });

  it('does not recursively expand a title containing a placeholder pattern', () => {
    const tricky: RenderableArea[] = [
      { slug: 'real-slug', title: '{{areaSlug}}', entryCount: 0 },
    ];
    const result = renderAreasIndex(tricky, '{{areaList}}', {
      itemTemplate: '- {{areaTitle}} / {{areaSlug}}',
    });
    // Single-pass: {{areaTitle}} → "{{areaSlug}}" literal, not expanded again.
    expect(result).toBe('- {{areaSlug}} / real-slug');
  });
});
