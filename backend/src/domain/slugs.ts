import slugify from '@sindresorhus/slugify';
import type { Area } from './area.ts';
import { InvalidAreaNameError, ReservedAreaNameError } from './errors.ts';

/**
 * Explicit German transliteration table per ADR-0006.
 * Declared here rather than relying on the library's builtin defaults so that
 * the mapping is deterministic and visible in the codebase regardless of future
 * library changes or locale configuration.
 */
const GERMAN_REPLACEMENTS = [
  ['ä', 'ae'],
  ['Ä', 'ae'],
  ['ö', 'oe'],
  ['Ö', 'oe'],
  ['ü', 'ue'],
  ['Ü', 'ue'],
  ['ß', 'ss'],
] as const satisfies ReadonlyArray<[string, string]>;

const RESERVED_AREA_SLUGS = new Set(['inbox', 'areas']);

const ENTRY_CONTENT_MAX_WORDS = 6;
const ENTRY_CONTENT_MAX_CHARS = 50;

/**
 * Converts human text (German included) into a safe, lowercase, dash-separated slug.
 * Returns '' when nothing survives normalization — the caller decides the fallback.
 */
export function slugifyText(value: string): string {
  return slugify(value, {
    customReplacements: GERMAN_REPLACEMENTS,
    lowercase: true,
    decamelize: false,
  });
}

/**
 * Produces a content slug from the first ~6 words, hard-capped at ~50 chars.
 * Truncated on a word boundary with no trailing '-'.
 * Empty or symbol-only input falls back to 'entry' (entries never error).
 */
export function slugifyEntryContent(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean).slice(0, ENTRY_CONTENT_MAX_WORDS);
  const slug = buildTruncatedSlug(words.join(' '));
  return slug || 'entry';
}

function buildTruncatedSlug(text: string): string {
  let slug = slugifyText(text);

  if (slug.length <= ENTRY_CONTENT_MAX_CHARS) {
    return slug;
  }

  const candidate = slug.slice(0, ENTRY_CONTENT_MAX_CHARS);
  const lastDash = candidate.lastIndexOf('-');
  slug = lastDash > 0 ? candidate.slice(0, lastDash) : candidate;

  return slug.replace(/-+$/, '');
}

/**
 * Returns the raw slug for an Area name. No validation, no throw.
 */
export function slugifyAreaName(name: string): string {
  return slugifyText(name);
}

/**
 * Validates an Area name and returns a typed Area value object.
 *
 * Throws InvalidAreaNameError  for empty, whitespace-only, or symbol-only names.
 * Throws ReservedAreaNameError for the reserved slugs 'inbox' and 'areas'.
 */
export function validateAreaName(name: string): Area {
  const trimmed = name.trim();

  if (!trimmed) {
    throw new InvalidAreaNameError(name);
  }

  const slug = slugifyText(trimmed);

  if (!slug) {
    throw new InvalidAreaNameError(name);
  }

  if (RESERVED_AREA_SLUGS.has(slug)) {
    throw new ReservedAreaNameError(name);
  }

  return { slug, title: trimmed };
}
