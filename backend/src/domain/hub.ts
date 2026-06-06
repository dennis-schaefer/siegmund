import type { RenderableArea } from './area.ts';

type HubArea = {
  readonly title: string;
  readonly slug: string;
};

const DEFAULT_ITEM_TEMPLATE = '- [[areas/{{areaSlug}}/_hub|{{areaTitle}}]]';
const DEFAULT_LIST_PLACEHOLDER = '{{areaList}}';

/**
 * Performs a single-pass substitution of known placeholders in the given
 * template. Unknown placeholders are left untouched. Single-pass means a value
 * that itself contains a placeholder pattern is never recursively expanded.
 */
function substituteOnce(template: string, substitutions: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(substitutions, key)
      ? substitutions[key]
      : match;
  });
}

/**
 * Renders a Hub template for a single Area. Substitutes {{areaTitle}} and
 * {{areaSlug}}; unknown placeholders are left untouched.
 */
export function renderHub(area: HubArea, template: string): string {
  return substituteOnce(template, { areaTitle: area.title, areaSlug: area.slug });
}

export type RenderAreasIndexOptions = {
  /** Item template applied per area. Defaults to `- [[areas/{{areaSlug}}/_hub|{{areaTitle}}]]`. */
  readonly itemTemplate?: string;
  /** Placeholder in the outer template to replace with the joined list. Defaults to `{{areaList}}`. */
  readonly listPlaceholder?: string;
};

/**
 * Renders an index of Areas into the outer template by:
 *  1. Rendering each RenderableArea with the item template (single-pass).
 *  2. Joining the items with newlines.
 *  3. Replacing the list placeholder in the outer template with the joined string.
 */
export function renderAreasIndex(
  areas: RenderableArea[],
  template: string,
  options?: RenderAreasIndexOptions,
): string {
  const itemTemplate = options?.itemTemplate ?? DEFAULT_ITEM_TEMPLATE;
  const listPlaceholder = options?.listPlaceholder ?? DEFAULT_LIST_PLACEHOLDER;

  const renderedItems = areas.map((area) =>
    substituteOnce(itemTemplate, { areaTitle: area.title, areaSlug: area.slug }),
  );
  const list = renderedItems.join('\n');

  // Replace the list placeholder with the rendered list (plain string replace,
  // not a regex, to avoid issues with special regex characters in the placeholder).
  return template.split(listPlaceholder).join(list);
}
