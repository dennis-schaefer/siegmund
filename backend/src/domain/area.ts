/**
 * Area — a top-level subject grouping that owns Entries (e.g. "SW Projekt X").
 * Backed by a Vault folder; `slug` is the folder name, `title` is the display name.
 */
export type Area = {
  readonly slug: string;
  readonly title: string;
};

/**
 * RenderableArea — an Area enriched with display-time aggregate data
 * (e.g. entry count) for Hub indexes and UI listings.
 */
export type RenderableArea = Area & {
  readonly entryCount: number;
};
