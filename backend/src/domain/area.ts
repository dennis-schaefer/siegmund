/**
 * Area — a top-level subject grouping that owns Entries (e.g. "SW Projekt X").
 * Backed by a Vault folder; `slug` is the folder name, `title` is the display name.
 */
export type Area = {
  readonly slug: string;
  readonly title: string;
};

/**
 * RenderableArea — an Area ready to be rendered into a Hub index or UI listing.
 */
export type RenderableArea = Area;
